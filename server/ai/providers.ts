/**
 * Adaptadores de provedor de LLM.
 *
 * Invariante nº 7 do projeto ("provedores são substituíveis") virando estrutura: **nenhum SDK de
 * fornecedor é importado em lugar nenhum**. Tudo passa por `fetch` contra a API HTTP e pela interface
 * `ProviderAdapter`. Trocar de fornecedor é trocar configuração (`REBECA_MODEL_*`), não código de
 * tela nem de regra de negócio.
 *
 * Fatos de API aqui dentro vêm da pesquisa com fonte e data em
 * `.rebeca/pesquisa/llm-spec-*.md`. O que não foi verificado está marcado `NÃO VERIFICADO` — e a
 * consequência prática é que estes adaptadores **não dependem** de nada não verificado para
 * funcionar: eles usam só endpoint, header de autenticação, formato de mensagem e campo de `usage`,
 * que são justamente os itens lidos na documentação oficial.
 *
 * Um ponto de assimetria que mudou o desenho: **nem todo provedor aceita JSON Schema na resposta.**
 * OpenAI aceita (`response_format.json_schema` com `strict`); DeepSeek só aceita `json_object`, que
 * garante "JSON válido" mas **não** aderência ao schema. Por isso a validação local, em
 * `src/ai/schemas.ts`, é a que decide — o parâmetro do provedor é conveniência, nunca a garantia.
 */

import { AiError } from '../../src/ai/contract.js';
import { AI_LIMITS } from '../../src/ai/limits.js';
import type { JsonSchema } from '../../src/ai/schemas.js';

export type ProviderId = 'openai' | 'deepseek' | 'anthropic' | 'google' | 'openrouter' | 'simulado';

/** Provedor real (tudo menos a simulação). */
export type RealProviderId = Exclude<ProviderId, 'simulado'>;

/** Os que falam o dialeto `chat/completions` e por isso compartilham um único adaptador. */
export type OpenAiCompatibleProviderId = 'openai' | 'deepseek' | 'openrouter';

export interface ProviderCall {
  readonly model: string;
  readonly system: string;
  readonly user: string;
  readonly maxOutputTokens: number;
  /** `null` quando a função não declara schema de saída (nenhuma declara, hoje — todas declaram). */
  readonly jsonSchema: JsonSchema | null;
  readonly signal: AbortSignal;
  readonly apiKey: string;
  /**
   * Endereço do provedor a usar nesta chamada.
   *
   * Vem resolvido pelo handler (configuração salva na tela de Configurações > variável de ambiente >
   * padrão do catálogo) e **já validado** contra SSRF por `assertSafeProviderUrl`. O adaptador não
   * decide endereço: ele recebe um endereço que passou pelo portão.
   */
  readonly baseUrl: string;
}

export interface ProviderResponse {
  readonly raw: string;
  readonly tokensIn: number;
  readonly tokensOut: number;
}

export interface ProviderAdapter {
  readonly id: ProviderId;
  /** Variável de ambiente que carrega a chave. Nunca é lida pelo cliente. */
  readonly envVar: string;
  /**
   * Nome que o provedor dá ao parâmetro de limite de tokens de saída. Muda entre fornecedores e
   * entre gerações do mesmo fornecedor — por isso é dado do adaptador, não constante global.
   */
  readonly maxTokensParam: string;
  /** `true` quando o provedor aceita JSON Schema de verdade (e não só "JSON válido"). */
  readonly supportsJsonSchema: boolean;
  /**
   * Endereço oficial do provedor. É o padrão **e** a referência da tela de Configurações: mostrar o
   * padrão é o que permite ao operador perceber que trocou o endereço por engano.
   */
  readonly defaultBaseUrl: string;
  complete(call: ProviderCall): Promise<ProviderResponse>;
}

/** Erro de rede/HTTP do provedor. **Nunca** carrega a chave nem o corpo cru da resposta. */
function providerError(detail: string, status = 502, retryable = true): AiError {
  return new AiError(
    {
      code: 'provedor',
      message: 'O provedor de IA não respondeu como esperado. Nada foi gerado e nada foi publicado.',
      detail,
      retryable,
    },
    status,
  );
}

/**
 * Mensagem de erro segura a partir do corpo do provedor.
 *
 * A resposta de erro de uma API costuma repetir parte da requisição — inclusive cabeçalhos, em alguns
 * casos. Aqui só extraímos o **tipo** e a **mensagem** de erro, truncada, e nunca ecoamos o corpo
 * inteiro no log nem na resposta ao navegador (skill `rebeca-seguranca`, princípio 3).
 */
function safeProviderMessage(body: unknown): string {
  if (typeof body !== 'object' || body === null) return 'corpo de erro não reconhecido';
  const record = body as Record<string, unknown>;
  const error = record['error'];
  if (typeof error === 'object' && error !== null) {
    const errorRecord = error as Record<string, unknown>;
    const type = typeof errorRecord['type'] === 'string' ? errorRecord['type'] : 'erro';
    const message = typeof errorRecord['message'] === 'string' ? errorRecord['message'] : '';
    return `${type}: ${message.slice(0, 300)}`;
  }
  if (typeof record['message'] === 'string') return record['message'].slice(0, 300);
  return 'erro sem detalhe legível';
}

interface CompletionFields {
  readonly raw: string;
  readonly tokensIn: number;
  readonly tokensOut: number;
}

/** Extrai texto e `usage` do formato de resposta estilo OpenAI/DeepSeek/OpenRouter. */
function readOpenAiStyle(body: unknown, maxOutputTokens: number): CompletionFields {
  if (typeof body !== 'object' || body === null) throw providerError('resposta não é objeto');
  const record = body as Record<string, unknown>;

  const choices = record['choices'];
  if (!Array.isArray(choices) || choices.length === 0) {
    throw providerError('resposta sem "choices"');
  }
  const first = choices[0] as Record<string, unknown> | undefined;

  /*
   * `finish_reason: 'length'` = a resposta foi **cortada no teto de tokens** desta função.
   *
   * O JSON sai incompleto, a validação de schema recusa e o que chegava à tela era um **502 genérico**
   * ("não respondeu como esperado") — sem dizer que a causa era o tamanho da saída. O livro de custos
   * mostrou `criar-cena@v1 (falhou)` e `criar-roteiro@v1 (falhou)` com exatamente 6.000 e 8.000 tokens
   * de saída: o teto, não um defeito do provedor.
   *
   * `retryable: false` de propósito: repetir a mesma requisição corta no mesmo lugar e **paga de novo**.
   */
  if (first?.['finish_reason'] === 'length') {
    throw new AiError(
      {
        code: 'provedor',
        message: `O modelo foi interrompido no limite de ${maxOutputTokens} tokens de saída e a resposta ficou incompleta — por isso ela não foi aceita. Reduza o escopo desta chamada (menos cenas de uma vez) ou aumente o orçamento de saída da função. Nada foi publicado.`,
        detail: `finish_reason: length (limite de ${maxOutputTokens} tokens de saída)`,
        retryable: false,
      },
      502,
    );
  }

  const message = first?.['message'] as Record<string, unknown> | undefined;
  const content = message?.['content'];
  if (typeof content !== 'string') {
    throw providerError('resposta sem texto em "choices[0].message.content"');
  }

  const usage = (record['usage'] ?? {}) as Record<string, unknown>;
  const tokensIn = Number(usage['prompt_tokens'] ?? 0);
  const tokensOut = Number(usage['completion_tokens'] ?? 0);

  return {
    raw: content,
    tokensIn: Number.isFinite(tokensIn) ? tokensIn : 0,
    tokensOut: Number.isFinite(tokensOut) ? tokensOut : 0,
  };
}

/** POST JSON com tratamento uniforme de erro. Devolve o corpo já decodificado. */
async function postJson(
  url: string,
  headers: Record<string, string>,
  payload: unknown,
  signal: AbortSignal,
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(payload),
      signal,
    });
  } catch (error) {
    /*
     * `AbortError` é o teto de tempo (`AI_LIMITS.requestTimeoutMs`). A tela mostrava só "tempo esgotado
     * na chamada ao provedor" — sem o limite, sem dizer se houve gasto e sem o que fazer. O dono do
     * produto levou um **HTTP 504** e não tinha como saber nem quanto esperou nem se pagou.
     */
    if (error instanceof Error && error.name === 'AbortError') {
      throw new AiError(
        {
          code: 'provedor',
          message: `O provedor demorou mais de ${Math.round(AI_LIMITS.requestTimeoutMs / 1000)} s e a chamada foi cancelada. Nada foi gerado e nada foi cobrado — tente de novo ou escolha um modelo mais rápido para esta função (Configurações → Inteligência artificial → Modelo por função).`,
          detail: 'tempo esgotado na chamada ao provedor',
          retryable: true,
        },
        504,
      );
    }
    throw providerError('falha de rede', 504, true);
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    // 429 e 5xx são retentáveis; 4xx de credencial/requisição não são.
    const retryable = response.status === 429 || response.status >= 500;
    throw providerError(`HTTP ${response.status} — ${safeProviderMessage(body)}`, 502, retryable);
  }

  return body;
}

/* =============================================================================
   Família "OpenAI-compatible": OpenAI, DeepSeek e OpenRouter
   ============================================================================= */

/**
 * Os três falam o mesmo dialeto (`/chat/completions`, `Authorization: Bearer`, `choices[0].message.content`,
 * `usage.prompt_tokens`). O que muda é a URL base, o nome do parâmetro de limite de tokens e o
 * suporte a JSON Schema — por isso o adaptador é parametrizado em vez de triplicado.
 *
 * Cobertura de fato, com fonte em `.rebeca/pesquisa/llm-spec-openai-deepseek.md`:
 * - OpenAI: `POST https://api.openai.com/v1/chat/completions`, `max_completion_tokens`,
 *   `response_format.json_schema` com `strict`.
 * - DeepSeek: `POST https://api.deepseek.com/chat/completions`, `max_tokens`,
 *   `response_format: {"type":"json_object"}` (sem schema).
 * - OpenRouter: mesmo dialeto da OpenAI; o suporte a `json_schema` depende do modelo escolhido, então
 *   o adaptador **não** afirma suporte — envia `json_object` e conta com a validação local.
 */
function openAiCompatible(options: {
  id: ProviderId;
  envVar: string;
  baseUrl: string;
  maxTokensParam: string;
  supportsJsonSchema: boolean;
  extraHeaders?: Record<string, string>;
}): ProviderAdapter {
  return {
    id: options.id,
    envVar: options.envVar,
    maxTokensParam: options.maxTokensParam,
    supportsJsonSchema: options.supportsJsonSchema,
    defaultBaseUrl: options.baseUrl,

    async complete(call: ProviderCall): Promise<ProviderResponse> {
      const payload: Record<string, unknown> = {
        model: call.model,
        messages: [
          { role: 'system', content: call.system },
          { role: 'user', content: call.user },
        ],
        [options.maxTokensParam]: call.maxOutputTokens,
        stream: false,
      };

      if (call.jsonSchema) {
        payload['response_format'] = options.supportsJsonSchema
          ? {
              type: 'json_schema',
              json_schema: {
                name: 'resposta',
                // `strict: true` é o que faz o provedor *validar* em vez de só "tentar" JSON.
                strict: true,
                schema: call.jsonSchema,
              },
            }
          : // `json_object` garante JSON válido, não aderência ao schema. A doc da DeepSeek exige a
            // palavra "json" no prompt — o prompt de toda função termina com "Responda somente com o
            // objeto JSON.", então a exigência está satisfeita sem gambiarra.
            { type: 'json_object' };
      }

      const body = await postJson(
        // Endereço resolvido e validado pelo handler — o adaptador não escolhe para onde falar.
        call.baseUrl,
        {
          authorization: `Bearer ${call.apiKey}`,
          ...(options.extraHeaders ?? {}),
        },
        payload,
        call.signal,
      );

      return readOpenAiStyle(body, call.maxOutputTokens);
    },
  };
}

/* =============================================================================
   Registro
   ============================================================================= */

export const PROVIDERS: Readonly<Record<OpenAiCompatibleProviderId, ProviderAdapter>> = {
  openai: openAiCompatible({
    id: 'openai',
    envVar: 'OPENAI_API_KEY',
    baseUrl: 'https://api.openai.com/v1/chat/completions',
    maxTokensParam: 'max_completion_tokens',
    supportsJsonSchema: true,
  }),

  deepseek: openAiCompatible({
    id: 'deepseek',
    envVar: 'DEEPSEEK_API_KEY',
    baseUrl: 'https://api.deepseek.com/chat/completions',
    maxTokensParam: 'max_tokens',
    supportsJsonSchema: false,
  }),

  /**
   * `HTTP-Referer` e `X-OpenRouter-Title` são os cabeçalhos de atribuição do OpenRouter. São
   * opcionais e não carregam segredo; servem para identificar a aplicação no painel do provedor.
   *
   * `supportsJsonSchema: false` é escolha deliberada, e a razão é específica: o OpenRouter **aceita**
   * `response_format.json_schema` na porta dele, mas roteia para provedores de origem diferentes, e o
   * próprio aviso da documentação é que "exact compliance is not guaranteed on every endpoint". Como
   * `json_object` é aceito universalmente e a validação de schema acontece de qualquer forma no
   * servidor (`src/ai/schemas.ts`), pedir `json_schema` aqui só acrescentaria risco de erro de
   * requisição em troca de uma garantia que o roteador não dá.
   */
  openrouter: openAiCompatible({
    id: 'openrouter',
    envVar: 'OPENROUTER_API_KEY',
    baseUrl: 'https://openrouter.ai/api/v1/chat/completions',
    maxTokensParam: 'max_tokens',
    supportsJsonSchema: false,
    extraHeaders: {
      'http-referer': 'https://github.com/donclaudito/rebeca',
      'x-openrouter-title': 'Rebeca',
    },
  }),
};

/**
 * Variável de ambiente de cada provedor.
 *
 * Vive aqui — e não só dentro de cada adaptador — porque o painel de configuração precisa dizer ao
 * usuário **qual** variável falta sem instanciar adaptador nenhum. E porque Anthropic e Google têm
 * arquivo próprio (`providers-extra.ts`): sem este mapa, `providerKey('anthropic')` não teria como
 * saber o nome da variável sem importar o outro módulo e criar dependência circular.
 */
export const PROVIDER_ENV: Readonly<Record<RealProviderId, string>> = {
  openai: 'OPENAI_API_KEY',
  deepseek: 'DEEPSEEK_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  google: 'GEMINI_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
};

/** Chave configurada no ambiente do servidor. Devolve `''` quando não há — nunca lança. */
export function providerKey(provider: ProviderId): string {
  if (provider === 'simulado') return '';
  return (process.env[PROVIDER_ENV[provider]] ?? '').trim();
}
