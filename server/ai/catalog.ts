/**
 * Catálogo de modelos: o que cada nível (`AiTier`) vira em modelo concreto, quanto custa e para qual
 * canal pode ser usado.
 *
 * Este é o único lugar do sistema onde existe nome de modelo. Nem a tela, nem o contrato, nem o
 * prompt conhecem "gpt-…" ou "claude-…" — eles conhecem `raciocinio`, `criativo`, `rapido`, `visao`
 * (AGENTS.md, invariante nº 7).
 *
 * Três regras que o arquivo faz valer:
 *
 * 1. **Preço só entra com fonte e data.** Cada linha traz `sourceUrl` e `readAt`. Modelo que não
 *    está no catálogo ainda pode ser usado (via `REBECA_MODEL_*`), mas o custo dele vai para o livro
 *    como `nao-verificado` em vez de virar um número inventado.
 * 2. **Allow-list é por canal, não global.** É o que o `ADR-005` fixou para os provedores de mídia, e
 *    a mesma lógica vale aqui: canal infantil só usa fornecedor cujo termo permite serviço dirigido a
 *    menores. Ver `minorPolicy`.
 * 3. **Teto antes do gasto.** `estimateCostUsd` roda antes do POST; o handler recusa a chamada que
 *    passaria do teto por chamada.
 */

import { AI_LIMITS } from '../../src/ai/limits';
import type { AiTier } from '../../src/ai/contract';
import type { RealProviderId } from './providers';

export type { RealProviderId };

/**
 * O que o termo do fornecedor diz sobre serviço dirigido a menores de 18 anos.
 *
 * `permitido` — permite, eventualmente com salvaguardas a cumprir.
 * `restrito-menores` — **veda**, com cláusula literal lida.
 * `nao-verificado` — há cláusula que pode alcançar o caso, e a leitura jurídica está pendente.
 *
 * O gate do canal infantil aceita `permitido`. `nao-verificado` é tratado como **não permitido por
 * padrão** — o custo do erro é assimétrico (suspensão de conta contra conveniência de escolher
 * fornecedor), e existe `REBECA_ALLOW_UNVERIFIED_MINOR_POLICY=1` para o dono do produto assumir a
 * decisão de forma explícita, em vez de o agente assumi-la em silêncio.
 */
export type MinorPolicy = 'permitido' | 'restrito-menores' | 'nao-verificado';

export interface ModelEntry {
  readonly provider: RealProviderId;
  readonly model: string;
  readonly label: string;
  readonly inputUsdPerMillion: number;
  readonly outputUsdPerMillion: number;
  readonly supportsJsonSchema: boolean;
  readonly supportsVision: boolean;
  readonly maxOutputTokens: number;
  readonly minorPolicy: MinorPolicy;
  /** De onde veio o preço. Sem isto, o número não entra. */
  readonly sourceUrl: string;
  readonly readAt: string;
  /**
   * Preço promocional com data de validade conhecida.
   *
   * A `gemini-3.8-flash` está em US$ 0,75/3,75 **até 31/12/2026** e passa a US$ 1,50/7,50 em
   * 01/01/2027 (fonte: página oficial de preços, lida em 2026-09-30). Guardar só o preço promocional
   * faria o livro de custos mentir a partir de janeiro — e a data está aqui justamente para que isso
   * seja impossível de esquecer.
   */
  readonly promoUntil?: string;
  readonly promoInputUsdPerMillion?: number;
  readonly promoOutputUsdPerMillion?: number;
}

const READ_AT = '2026-09-30';

const SRC_OPENAI = 'https://developers.openai.com/api/docs/pricing.md';
const SRC_DEEPSEEK = 'https://api-docs.deepseek.com/quick_start/pricing';
const SRC_ANTHROPIC = 'https://platform.claude.com/docs/en/about-claude/pricing';
const SRC_GOOGLE = 'https://ai.google.dev/gemini-api/docs/pricing';
const SRC_OPENROUTER = 'https://openrouter.ai/api/v1/models';

function entry(
  provider: RealProviderId,
  model: string,
  label: string,
  inputUsdPerMillion: number,
  outputUsdPerMillion: number,
  options: {
    supportsJsonSchema: boolean;
    supportsVision?: boolean;
    maxOutputTokens?: number;
    minorPolicy: MinorPolicy;
    sourceUrl: string;
    promoUntil?: string;
    promoInputUsdPerMillion?: number;
    promoOutputUsdPerMillion?: number;
  },
): ModelEntry {
  return {
    provider,
    model,
    label,
    inputUsdPerMillion,
    outputUsdPerMillion,
    supportsJsonSchema: options.supportsJsonSchema,
    supportsVision: options.supportsVision ?? false,
    maxOutputTokens: options.maxOutputTokens ?? 128_000,
    minorPolicy: options.minorPolicy,
    sourceUrl: options.sourceUrl,
    readAt: READ_AT,
    ...(options.promoUntil === undefined ? {} : { promoUntil: options.promoUntil }),
    ...(options.promoInputUsdPerMillion === undefined
      ? {}
      : { promoInputUsdPerMillion: options.promoInputUsdPerMillion }),
    ...(options.promoOutputUsdPerMillion === undefined
      ? {}
      : { promoOutputUsdPerMillion: options.promoOutputUsdPerMillion }),
  };
}

/**
 * Catálogo. Preços em USD por 1 milhão de tokens, leitura de 2026-09-30.
 *
 * `minorPolicy` está explicado em cada bloco de fornecedor, com o trecho que sustenta a classificação
 * no arquivo de pesquisa correspondente em `.rebeca/pesquisa/`.
 */
export const CATALOG: readonly ModelEntry[] = [
  /* --- OpenAI -------------------------------------------------------------
   * Política de menores: a OpenAI **não** proíbe produto voltado a menores; exige salvaguardas
   * auditáveis (filtros, verificação de idade, COPPA) sob risco de suspensão. Por isso `permitido`,
   * com a ressalva de que as salvaguardas precisam existir no produto, não só no fornecedor.
   * Fonte: `.rebeca/pesquisa/llm-spec-openai-deepseek.md` §6.
   */
  entry('openai', 'gpt-6.1-sol', 'GPT-6.1 Sol', 2, 10, {
    supportsJsonSchema: true,
    supportsVision: true,
    minorPolicy: 'permitido',
    sourceUrl: SRC_OPENAI,
  }),
  entry('openai', 'gpt-6-luna', 'GPT-6 Luna', 0.1, 0.5, {
    supportsJsonSchema: true,
    supportsVision: true,
    minorPolicy: 'permitido',
    sourceUrl: SRC_OPENAI,
  }),
  entry('openai', 'gpt-6-astra', 'GPT-6 Astra', 10, 50, {
    supportsJsonSchema: true,
    supportsVision: true,
    minorPolicy: 'permitido',
    sourceUrl: SRC_OPENAI,
  }),
  entry('openai', 'gpt-5.6-sol', 'GPT-5.6 Sol', 4, 20, {
    supportsJsonSchema: true,
    minorPolicy: 'permitido',
    sourceUrl: SRC_OPENAI,
  }),
  entry('openai', 'gpt-5.6-luna', 'GPT-5.6 Luna', 0.2, 1.2, {
    supportsJsonSchema: true,
    minorPolicy: 'permitido',
    sourceUrl: SRC_OPENAI,
  }),
  entry('openai', 'gpt-5-nano', 'GPT-5 Nano', 0.05, 0.4, {
    supportsJsonSchema: true,
    minorPolicy: 'permitido',
    sourceUrl: SRC_OPENAI,
  }),

  /* --- Anthropic ----------------------------------------------------------
   * A Usage Policy permite explicitamente "products serving minors" **com salvaguardas** e auditoria.
   * As Commercial Terms — que são as que regem uso de API key — não têm cláusula numérica de idade.
   * Fonte: `.rebeca/pesquisa/llm-spec-anthropic-google-openrouter.md` §6.
   */
  entry('anthropic', 'claude-opus-5-5', 'Claude Opus 5.5', 4, 20, {
    supportsJsonSchema: true,
    supportsVision: true,
    minorPolicy: 'permitido',
    sourceUrl: SRC_ANTHROPIC,
  }),
  entry('anthropic', 'claude-sonnet-5-5', 'Claude Sonnet 5.5', 2, 10, {
    supportsJsonSchema: true,
    supportsVision: true,
    minorPolicy: 'permitido',
    sourceUrl: SRC_ANTHROPIC,
  }),
  entry('anthropic', 'claude-haiku-4-5-20251001', 'Claude Haiku 4.5', 1, 5, {
    supportsJsonSchema: true,
    supportsVision: true,
    maxOutputTokens: 64_000,
    minorPolicy: 'permitido',
    sourceUrl: SRC_ANTHROPIC,
  }),

  /* --- DeepSeek -----------------------------------------------------------
   * Termos §3.4(8) proíbem conteúdo "designed to specifically appeal to or present a persona of any
   * person under the age of 18". O canal piloto é infantil e tem personagem criança — o caso cai,
   * literalmente, na descrição. A leitura jurídica do alcance da cláusula está **pendente**, então a
   * classificação honesta é `nao-verificado`, não `permitido`.
   * Fonte: `.rebeca/pesquisa/llm-spec-openai-deepseek.md` §6.
   *
   * Preços abaixo são os **fora de pico**; em pico (01–04h e 06–10h UTC, seg–sex) dobram —
   * `effectivePrice` aplica isso.
   */
  entry('deepseek', 'deepseek-v4-pro', 'DeepSeek V4 Pro', 0.66, 1.98, {
    supportsJsonSchema: false,
    supportsVision: false,
    minorPolicy: 'nao-verificado',
    sourceUrl: SRC_DEEPSEEK,
  }),
  entry('deepseek', 'deepseek-flash', 'DeepSeek Flash', 0.15, 0.6, {
    supportsJsonSchema: false,
    supportsVision: true,
    minorPolicy: 'nao-verificado',
    sourceUrl: SRC_DEEPSEEK,
  }),

  /* --- Google (Gemini) ----------------------------------------------------
   * VEDADO para serviço dirigido a menores, com cláusula literal — a mesma do `ADR-005` para mídia:
   * "You also will not use the Services as part of a website, application, or other service
   * (collectively, 'API Clients') that is directed towards or is likely to be accessed by
   * individuals under the age of 18."
   * Fonte: `.rebeca/pesquisa/llm-spec-anthropic-google-openrouter.md` §6 (ai.google.dev/gemini-api/terms).
   */
  entry('google', 'gemini-3.8-flash', 'Gemini 3.8 Flash', 1.5, 7.5, {
    supportsJsonSchema: true,
    supportsVision: true,
    maxOutputTokens: 65_536,
    minorPolicy: 'restrito-menores',
    sourceUrl: SRC_GOOGLE,
    // Promoção vigente na leitura; o preço cheio (acima) passa a valer em 01/01/2027.
    promoUntil: '2026-12-31',
    promoInputUsdPerMillion: 0.75,
    promoOutputUsdPerMillion: 3.75,
  }),

  /* --- OpenRouter ---------------------------------------------------------
   * É revenda: o termo do modelo chamado continua valendo (§5.8 — "OpenRouter does not modify,
   * waive, or limit any Model Terms"). Logo, a política de menores depende de **qual** modelo está
   * por baixo, e o OpenRouter não lava essa restrição. `nao-verificado` é a classificação correta.
   * Fonte: `.rebeca/pesquisa/llm-spec-anthropic-google-openrouter.md` §6.
   */
  entry('openrouter', 'anthropic/claude-sonnet-5.5', 'Claude Sonnet 5.5 (via OpenRouter)', 2, 10, {
    supportsJsonSchema: true,
    supportsVision: true,
    minorPolicy: 'nao-verificado',
    sourceUrl: SRC_OPENROUTER,
  }),
  entry('openrouter', 'google/gemini-3.8-flash', 'Gemini 3.8 Flash (via OpenRouter)', 0.75, 3.75, {
    supportsJsonSchema: true,
    supportsVision: true,
    minorPolicy: 'restrito-menores',
    sourceUrl: SRC_OPENROUTER,
  }),
  entry('openrouter', 'google/gemini-2.5-flash-lite', 'Gemini 2.5 Flash Lite (via OpenRouter)', 0.1, 0.4, {
    supportsJsonSchema: true,
    supportsVision: true,
    minorPolicy: 'restrito-menores',
    sourceUrl: SRC_OPENROUTER,
  }),
];

/* =============================================================================
   Qual modelo atende cada nível
   ============================================================================= */

/**
 * Modelo padrão por nível e fornecedor.
 *
 * Como a escolha foi feita (e não por "o mais novo"):
 * - `raciocinio` → o modelo forte de análise, sem ir ao topo absoluto de preço. `gpt-6.1-sol` e
 *   `claude-opus-5-5` analisam; `gpt-6-astra` (US$ 10/50) custa 5× e o ganho em analisar roteiro
 *   infantil não se justifica.
 * - `criativo` → modelo de prosa boa, não o mais caro. Na Anthropic, `claude-sonnet-5-5`; na OpenAI,
 *   o mesmo `gpt-6.1-sol`, porque a doc **não** classifica modelo por escrita criativa
 *   (`NÃO VERIFICADO` nos dois fornecedores) e inventar uma hierarquia de criatividade seria chute.
 * - `rapido` → o mais barato que ainda cumpre extração e normalização: `gpt-6-luna` (US$ 0,10/0,50) e
 *   `claude-haiku-4-5` são a diferença entre pagar centavos e pagar dólares por metadado.
 * - `visao` → só onde há imagem; na DeepSeek **apenas** `deepseek-flash` aceita visão
 *   (`deepseek-v4-pro` = "Not supported").
 */
const TIER_BY_PROVIDER: Record<RealProviderId, Record<AiTier, string>> = {
  openai: {
    raciocinio: 'gpt-6.1-sol',
    criativo: 'gpt-6.1-sol',
    rapido: 'gpt-6-luna',
    visao: 'gpt-6-luna',
  },
  anthropic: {
    raciocinio: 'claude-opus-5-5',
    criativo: 'claude-sonnet-5-5',
    rapido: 'claude-haiku-4-5-20251001',
    visao: 'claude-sonnet-5-5',
  },
  deepseek: {
    raciocinio: 'deepseek-v4-pro',
    criativo: 'deepseek-v4-pro',
    rapido: 'deepseek-flash',
    visao: 'deepseek-flash',
  },
  google: {
    raciocinio: 'gemini-3.8-flash',
    criativo: 'gemini-3.8-flash',
    rapido: 'gemini-3.8-flash',
    visao: 'gemini-3.8-flash',
  },
  openrouter: {
    raciocinio: 'anthropic/claude-sonnet-5.5',
    criativo: 'anthropic/claude-sonnet-5.5',
    rapido: 'google/gemini-2.5-flash-lite',
    visao: 'google/gemini-3.8-flash',
  },
};

/** Ordem de preferência quando há mais de uma chave configurada. Sobrescrevível por ambiente. */
const DEFAULT_PROVIDER_ORDER: readonly RealProviderId[] = [
  'openai',
  'anthropic',
  'deepseek',
  'openrouter',
  'google',
];

export function providerOrder(): readonly RealProviderId[] {
  const configured = (process.env.REBECA_PROVIDER_ORDER ?? '').trim();
  if (!configured) return DEFAULT_PROVIDER_ORDER;
  const parsed = configured
    .split(',')
    .map((item) => item.trim())
    .filter((item): item is RealProviderId => item in TIER_BY_PROVIDER);
  return parsed.length > 0 ? parsed : DEFAULT_PROVIDER_ORDER;
}

export function findModelEntry(provider: RealProviderId, model: string): ModelEntry | null {
  return CATALOG.find((item) => item.provider === provider && item.model === model) ?? null;
}

/** Modelo padrão do catálogo para (nível, fornecedor). */
export function defaultModelFor(tier: AiTier, provider: RealProviderId): ModelEntry | null {
  return findModelEntry(provider, TIER_BY_PROVIDER[provider][tier]);
}

/**
 * A allow-list por canal.
 *
 * `childDirected` é decidido pelo **servidor** (`server/ai/channels.ts`), nunca pelo cliente.
 */
export function isAllowedForChannel(
  policy: MinorPolicy,
  childDirected: boolean,
  options: { allowUnverified?: boolean } = {},
): boolean {
  if (!childDirected) return true;
  if (policy === 'permitido') return true;
  if (policy === 'nao-verificado') return options.allowUnverified === true;
  return false;
}

/** Quando `true`, o dono do produto assumiu usar fornecedor de política não verificada no canal infantil. */
export function allowUnverifiedMinorPolicy(): boolean {
  return process.env.REBECA_ALLOW_UNVERIFIED_MINOR_POLICY === '1';
}

/**
 * Quando `true`, o dono assume usar um modelo **sem preço verificado**.
 *
 * Por que isto é uma trava e não uma conveniência: o teto por chamada é calculado a partir do preço.
 * Sem preço na tabela não existe estimativa, e sem estimativa **a trava por chamada simplesmente não
 * se aplica** — a chamada sairia sem teto nenhum. Isso é o oposto do invariante nº 4 ("custo é
 * requisito") e transformaria um erro de digitação numa conta aberta.
 *
 * O default é recusar. Quem quiser experimentar um modelo novo liga esta variável, e a decisão fica
 * registrada como escolha do dono do produto — não como descuido do código.
 */
export function allowUnpricedModel(): boolean {
  return process.env.REBECA_ALLOW_UNPRICED_MODEL === '1';
}

/* =============================================================================
   Preço — com o caso especial da DeepSeek
   ============================================================================= */

/**
 * A DeepSeek publica **dois** preços por modelo: horário de pico e fora de pico. Pela tabela oficial
 * (lida 2026-09-30), o preço de pico é **o dobro** do fora de pico, e o pico é 01–04h e 06–10h UTC,
 * de segunda a sexta.
 *
 * Os valores do catálogo são os **fora de pico** (US$ 0,66/1,98 para o `deepseek-v4-pro` e
 * US$ 0,15/0,60 para o `deepseek-flash`); em pico, dobram.
 *
 * Usar um preço só seria errado nos dois sentidos: o de pico superfatura a conta e o fora de pico a
 * subestima — e **subestimar custo quebra o teto diário**, que é trava de segurança. Por isso o dia
 * da semana e a hora UTC entram na conta.
 *
 * `NÃO VERIFICADO`: a janela pode mudar sem aviso. Se a DeepSeek alterar, o livro de custos fica
 * desalinhado — a reavaliação obrigatória está registrada no `ADR-006`.
 */
export function deepseekIsPeak(now: Date): boolean {
  const weekday = now.getUTCDay(); // 0 = domingo, 6 = sábado
  if (weekday === 0 || weekday === 6) return false;
  const hour = now.getUTCHours();
  return (hour >= 1 && hour < 4) || (hour >= 6 && hour < 10);
}

/** Preço efetivo por milhão de tokens, resolvendo promoção vencida e o caso DeepSeek. */
export function effectivePrice(
  model: ModelEntry,
  now: Date,
): { inputUsdPerMillion: number; outputUsdPerMillion: number } {
  // Promoção vencida: vale o preço cheio. Comparar por string ISO funciona porque o formato é
  // `YYYY-MM-DD` — ordem lexicográfica é ordem cronológica.
  if (model.promoUntil !== undefined) {
    const today = now.toISOString().slice(0, 10);
    if (today <= model.promoUntil) {
      return {
        inputUsdPerMillion: model.promoInputUsdPerMillion ?? model.inputUsdPerMillion,
        outputUsdPerMillion: model.promoOutputUsdPerMillion ?? model.outputUsdPerMillion,
      };
    }
  }

  if (model.provider === 'deepseek' && deepseekIsPeak(now)) {
    // Em pico, a doc publica o dobro do preço fora de pico.
    return {
      inputUsdPerMillion: model.inputUsdPerMillion * 2,
      outputUsdPerMillion: model.outputUsdPerMillion * 2,
    };
  }

  return {
    inputUsdPerMillion: model.inputUsdPerMillion,
    outputUsdPerMillion: model.outputUsdPerMillion,
  };
}

/** Custo em USD de uma quantidade de tokens, dados os preços por milhão. */
export function priceTokens(
  tokensIn: number,
  tokensOut: number,
  price: { inputUsdPerMillion: number; outputUsdPerMillion: number },
): number {
  return (
    (tokensIn / 1_000_000) * price.inputUsdPerMillion +
    (tokensOut / 1_000_000) * price.outputUsdPerMillion
  );
}

/**
 * Estimativa **antes** de gastar, usada para a trava por chamada.
 *
 * A entrada é aproximada por caracteres/4 — é aproximação declarada, e serve para o que ela existe:
 * recusar a chamada que claramente estouraria o teto. O número que vai para o livro é o real, medido
 * pelo `usage` do provedor depois da resposta.
 */
export function estimateCostUsd(
  model: ModelEntry | null,
  promptChars: number,
  maxOutputTokens: number,
  now: Date,
): number | null {
  if (!model) return null;
  const tokensIn = Math.ceil(promptChars / 4);
  const price = effectivePrice(model, now);
  return priceTokens(tokensIn, maxOutputTokens, price);
}

/** Teto de tokens de saída que o modelo aceita, limitado pelo que a função pediu. */
export function outputTokenBudget(model: ModelEntry | null, requested: number): number {
  if (!model) return requested;
  return Math.min(requested, model.maxOutputTokens);
}

/** Teto de custo por chamada, lido do teto aprovado pelo humano. */
export const PER_CALL_LIMIT_USD = AI_LIMITS.perCallUsd;
