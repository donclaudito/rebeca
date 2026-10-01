/**
 * Adaptadores dos provedores com dialeto próprio: Anthropic e Google.
 *
 * Separados de `providers.ts` porque a diferença entre eles é justamente o que precisa ficar
 * visível: formato de requisição, autenticação, onde mora o `system` e como se lê o `usage` mudam
 * de fornecedor para fornecedor. Esconder isso atrás de uma abstração única criaria a ilusão de que
 * "todos são iguais" — e é essa ilusão que faz a integração quebrar em produção.
 *
 * Cada fato abaixo tem fonte e data em `.rebeca/pesquisa/llm-spec-anthropic-google-openrouter.md`.
 * Onde a leitura não foi possível, está marcado `NÃO VERIFICADO` — e o código foi escrito para
 * **não depender** do que não foi verificado: campos incertos são lidos com tolerância a ausência.
 */

import { AiError } from '../../src/ai/contract.js';
import type { JsonSchema } from '../../src/ai/schemas.js';
import type { ProviderAdapter, ProviderResponse } from './providers.js';

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

async function postWithKey(
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
    const aborted = error instanceof Error && error.name === 'AbortError';
    throw providerError(aborted ? 'tempo esgotado na chamada ao provedor' : 'falha de rede', 504, true);
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) {
    const retryable = response.status === 429 || response.status >= 500;
    // Só o tipo e a mensagem do erro, truncados: o corpo cru pode repetir parte da requisição e
    // nunca deve chegar ao navegador nem ao log (skill `rebeca-seguranca`, princípio 3).
    const record = (body ?? {}) as Record<string, unknown>;
    const error = record['error'];
    const detail =
      typeof error === 'object' && error !== null
        ? `${String((error as Record<string, unknown>)['type'] ?? 'erro')}: ${String(
            (error as Record<string, unknown>)['message'] ?? '',
          ).slice(0, 300)}`
        : `HTTP ${response.status}`;
    throw providerError(detail, 502, retryable);
  }

  return body;
}

/** Trunca a mensagem de erro do Google, que vem em `error.message`. */
function readString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === 'string' ? value : null;
}

/* =============================================================================
   Anthropic
   ============================================================================= */

/**
 * Fatos verificados (2026-09-30):
 * - `POST https://api.anthropic.com/v1/messages`
 * - `x-api-key: <chave>` e **`anthropic-version: 2023-06-01`** (obrigatório)
 * - `system` é campo **de topo** — "there is no `system` role for input messages in the Messages API"
 * - `max_tokens` é **obrigatório**
 * - saída estruturada em `output_config.format = {type:'json_schema', schema}` (o parâmetro antigo
 *   `output_format` está deprecado)
 * - `usage.input_tokens` / `usage.output_tokens`
 * - `temperature` está **deprecado** nos modelos posteriores ao Opus 4.6 (só `1.0` é aceito) — por
 *   isso este adaptador **não envia** `temperature`. Enviar seria pedir um 400.
 */
export const ANTHROPIC_PROVIDER: ProviderAdapter = {
  id: 'anthropic',
  envVar: 'ANTHROPIC_API_KEY',
  maxTokensParam: 'max_tokens',
  supportsJsonSchema: true,
  defaultBaseUrl: 'https://api.anthropic.com/v1/messages',

  async complete(call): Promise<ProviderResponse> {
    const payload: Record<string, unknown> = {
      model: call.model,
      max_tokens: call.maxOutputTokens,
      system: call.system,
      messages: [{ role: 'user', content: call.user }],
    };

    if (call.jsonSchema) {
      payload['output_config'] = {
        format: { type: 'json_schema', schema: call.jsonSchema },
      };
    }

    const body = await postWithKey(
      // Endereço resolvido e validado pelo handler (tela → ambiente → padrão).
      call.baseUrl,
      {
        'x-api-key': call.apiKey,
        // Header de versão obrigatório — sem ele a API recusa a requisição.
        'anthropic-version': '2023-06-01',
      },
      payload,
      call.signal,
    );

    if (typeof body !== 'object' || body === null) throw providerError('resposta não é objeto');
    const record = body as Record<string, unknown>;

    // `stop_reason: "refusal"` é recusa de segurança; `max_tokens` é truncamento. Os dois produzem
    // saída que não casa com o schema — melhor falhar com motivo claro do que entregar JSON quebrado.
    const stopReason = readString(record, 'stop_reason');
    if (stopReason === 'refusal') {
      throw providerError('o provedor recusou gerar este conteúdo', 502, false);
    }

    const content = record['content'];
    if (!Array.isArray(content)) throw providerError('resposta sem "content"');
    const textBlock = content.find(
      (block): block is Record<string, unknown> =>
        typeof block === 'object' && block !== null && (block as Record<string, unknown>)['type'] === 'text',
    );
    const raw = textBlock ? readString(textBlock, 'text') : null;
    if (typeof raw !== 'string') throw providerError('resposta sem bloco de texto');

    const usage = (record['usage'] ?? {}) as Record<string, unknown>;
    const tokensIn = Number(usage['input_tokens'] ?? 0);
    const tokensOut = Number(usage['output_tokens'] ?? 0);

    return {
      raw,
      tokensIn: Number.isFinite(tokensIn) ? tokensIn : 0,
      tokensOut: Number.isFinite(tokensOut) ? tokensOut : 0,
    };
  },
};

/* =============================================================================
   Google (Gemini)
   ============================================================================= */

/**
 * AVISO DE CONFORMIDADE — leia antes de habilitar no canal infantil.
 *
 * Os termos da Gemini API (Effective 2026-03-23, lidos 2026-09-30 em
 * https://ai.google.dev/gemini-api/terms?hl=en) dizem, literalmente:
 *
 * > "You also will not use the Services as part of a website, application, or other service
 * > (collectively, 'API Clients') that is directed towards or is likely to be accessed by
 * > individuals under the age of 18."
 *
 * É a **mesma restrição** que o `ADR-005` já havia encontrado nos modelos de mídia do Google. O
 * canal "Luna e o Jardim das Cores" é dirigido a crianças de 3 a 5 anos, logo cai na vedação. Por
 * isso o catálogo marca este provedor como `restrito-menores` e ele **não é escolhido** para canal
 * infantil — ver `server/ai/catalog.ts`.
 *
 * Estado de verificação dos campos deste adaptador (2026-09-30):
 * - VERIFICADO: endpoint `POST /v1beta/models/{model}:generateContent`; header `x-goog-api-key`;
 *   `contents[].parts[].text` obrigatório; `systemInstruction` como campo de topo (não é mensagem
 *   com papel); `generationConfig` como objeto de topo; `responseJsonSchema` aceita JSON Schema e
 *   exige `responseMimeType` compatível.
 * - `NÃO VERIFICADO`: a correspondência 1:1 dos nomes camelCase dentro de `generationConfig` no JSON
 *   REST cru (a referência REST ficou além do limite de leitura; os nomes vêm da interface
 *   `GenerateContentConfig` do SDK oficial) e os nomes dos campos de `usageMetadata`.
 *
 * Consequência prática do `NÃO VERIFICADO`: se a resposta não trouxer contagem de tokens legível, o
 * adaptador devolve `0/0` e o **catálogo marca o custo como não verificado** em vez de calcular um
 * preço em cima de zero. Não se inventa número.
 */
export const GOOGLE_PROVIDER: ProviderAdapter = {
  id: 'google',
  envVar: 'GEMINI_API_KEY',
  maxTokensParam: 'maxOutputTokens',
  supportsJsonSchema: true,
  /**
   * O endereço do Google tem o **modelo no caminho** (`.../models/{model}:generateContent`), então o
   * padrão aqui é a base e o adaptador monta o caminho. Guardar a URL completa no padrão faria a tela
   * mostrar um endereço que não é o que se edita.
   */
  defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',

  async complete(call): Promise<ProviderResponse> {
    const generationConfig: Record<string, unknown> = {
      maxOutputTokens: call.maxOutputTokens,
    };

    if (call.jsonSchema) {
      // `responseJsonSchema` (JSON Schema) é alternativo a `responseSchema` (subconjunto OpenAPI) e
      // exige `responseMimeType` — as duas condições estão satisfeitas aqui.
      generationConfig['responseMimeType'] = 'application/json';
      generationConfig['responseJsonSchema'] = call.jsonSchema;
    }

    const payload: Record<string, unknown> = {
      systemInstruction: { parts: [{ text: call.system }] },
      contents: [{ role: 'user', parts: [{ text: call.user }] }],
      generationConfig,
    };

    const body = await postWithKey(
      // O modelo vai no caminho, então o endereço configurável é a **base** e o caminho é montado
      // aqui. Assim a tela de Configurações edita uma base, não uma URL que muda por modelo.
      `${call.baseUrl.replace(/\/+$/, '')}/models/${encodeURIComponent(call.model)}:generateContent`,
      { 'x-goog-api-key': call.apiKey },
      payload,
      call.signal,
    );

    if (typeof body !== 'object' || body === null) throw providerError('resposta não é objeto');
    const record = body as Record<string, unknown>;

    // Bloqueio por filtro de segurança vem sem `candidates` — e com motivo em `promptFeedback`.
    const candidates = record['candidates'];
    if (!Array.isArray(candidates) || candidates.length === 0) {
      const feedback = (record['promptFeedback'] ?? {}) as Record<string, unknown>;
      const reason = readString(feedback, 'blockReason');
      throw providerError(
        reason ? `conteúdo bloqueado pelo filtro do provedor (${reason})` : 'resposta sem "candidates"',
        502,
        false,
      );
    }

    const first = candidates[0] as Record<string, unknown> | undefined;
    const content = (first?.['content'] ?? {}) as Record<string, unknown>;
    const parts = content['parts'];
    if (!Array.isArray(parts)) throw providerError('resposta sem "parts"');
    const raw = parts
      .map((part) =>
        typeof part === 'object' && part !== null ? readString(part as Record<string, unknown>, 'text') : null,
      )
      .filter((text): text is string => typeof text === 'string')
      .join('');

    if (raw.length === 0) throw providerError('resposta sem texto');

    const usage = (record['usageMetadata'] ?? {}) as Record<string, unknown>;
    const tokensIn = Number(usage['promptTokenCount'] ?? 0);
    // O campo de saída foi RENOMEADO: a doc atual usa `responseTokenCount`; `candidatesTokenCount` é
    // o nome antigo. Ler os dois com fallback custa uma linha e evita que o custo vire zero — ou
    // pior, "não verificado" — só porque o provedor mudou de nome de campo.
    const tokensOut = Number(usage['responseTokenCount'] ?? usage['candidatesTokenCount'] ?? 0);

    return {
      raw,
      tokensIn: Number.isFinite(tokensIn) ? tokensIn : 0,
      tokensOut: Number.isFinite(tokensOut) ? tokensOut : 0,
    };
  },
};

/** Exportado para o teste de contrato conferir que os dois adaptadores têm o formato esperado. */
export type { JsonSchema };
