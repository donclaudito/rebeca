/**
 * O orquestrador de uma chamada de IA.
 *
 * Ordem das operações — e a ordem **é** o desenho:
 *
 *   valida pedido → confere canal → resolve modelo → **trava de custo** → chama provedor →
 *   valida saída → calcula custo real → registra no livro → devolve
 *
 * A trava de custo vem **antes** da chamada. Trava que só descobre o gasto depois de pagar é
 * relatório, não trava.
 *
 * Regras que este arquivo garante, e onde cada uma vem:
 *
 * - Nenhuma função aprova, agenda ou publica. O resultado é sempre dado para a tela; a decisão é
 *   humana (AGENTS.md, invariante nº 1).
 * - O canal é conferido contra a lista do servidor, não contra o que o cliente afirmou
 *   (skill `rebeca-seguranca`, anti-padrão "confiar em `channel_id` vindo do cliente").
 * - Fornecedor vedado para serviço dirigido a menores não é escolhido para canal infantil, mesmo com
 *   a chave presente e mesmo sendo o único (skill `rebeca-lgpd`; `ADR-005`).
 * - Custo real entra no livro, inclusive quando a geração **falha** depois de o provedor já ter
 *   cobrado — geração falha que não foi registrada vira custo fantasma (invariante nº 4).
 * - Nenhuma mensagem de erro carrega chave, token ou corpo cru do provedor.
 */

import { AiError, getAiFunction, type AiRequest, type AiResult, type AiStatus, type AiTier, type AiUsage } from '../../src/ai/contract';
import { AI_LIMITS } from '../../src/ai/limits';
import { getFunctionSchema, validateSchema } from '../../src/ai/schemas';
import {
  allowUnpricedModel,
  allowUnverifiedMinorPolicy,
  defaultModelFor,
  effectivePrice,
  estimateCostUsd,
  findModelEntry,
  isAllowedForChannel,
  outputTokenBudget,
  priceTokens,
  providerOrder,
  type ModelEntry,
  type RealProviderId,
} from './catalog';
import { findServerChannel, type ServerChannel } from './channels';
import { recordCost, spentTodayUsd, ledgerPath, ledgerDisplayPath } from './ledger';
import { buildMessages, extractJson } from './prompt';
import { PROVIDERS, PROVIDER_ENV, providerKey, type ProviderId } from './providers';
import { PROMPTS } from './prompts.generated';
import { simulate } from './simulated';

/* =============================================================================
   Utilidades
   ============================================================================= */

/** Data local no formato do livro de custos (`YYYY-MM-DD`). */
function todayLocal(now: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function badRequest(code: AiError['code'], message: string, detail?: string): AiError {
  return new AiError(
    detail === undefined ? { code, message, retryable: false } : { code, message, detail, retryable: false },
    400,
  );
}

/** Lê a requisição crua e recusa o que não tem a forma mínima. */
function parseRequest(body: unknown): AiRequest {
  if (typeof body !== 'object' || body === null) {
    throw badRequest('entrada-invalida', 'O pedido chegou em formato inesperado.');
  }
  const record = body as Record<string, unknown>;

  const functionId = record['functionId'];
  if (typeof functionId !== 'string' || functionId.length === 0) {
    throw badRequest('funcao-desconhecida', 'Nenhuma função foi informada no pedido.');
  }

  const channelId = record['channelId'];
  if (typeof channelId !== 'string' || channelId.trim().length === 0) {
    // Mensagem própria e explícita: pedido sem canal é recusado, não "assumido" para o canal padrão.
    throw badRequest(
      'canal-obrigatorio',
      'O pedido não informou o canal. Toda função de IA é escopada por canal.',
    );
  }

  const input = record['input'];
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw badRequest('entrada-invalida', 'A entrada da função precisa ser um objeto.');
  }

  const note = record['note'];
  if (note !== undefined && typeof note !== 'string') {
    throw badRequest('entrada-invalida', 'O recado precisa ser texto.');
  }
  if (typeof note === 'string' && note.length > AI_LIMITS.maxNoteChars) {
    throw badRequest(
      'entrada-invalida',
      `O recado passou do limite de ${AI_LIMITS.maxNoteChars} caracteres.`,
    );
  }

  const contentId = record['contentId'];
  if (contentId !== undefined && typeof contentId !== 'string') {
    throw badRequest('entrada-invalida', 'O identificador de conteúdo precisa ser texto.');
  }
  if (typeof contentId === 'string') {
    // Limite e alfabeto: este valor vai para o livro de custos. Sem trava, um `contentId` de 200 KB —
    // ou com vírgula/quebra de linha — entra no CSV e o corrompe. Foi assim que o `rebeca-qa` fez o
    // teto diário deixar de somar. Identificador de conteúdo é identificador curto, não campo livre.
    if (contentId.length > 120) {
      throw badRequest('entrada-invalida', 'O identificador de conteúdo é longo demais.');
    }
    if (!/^[\w.:-]+$/.test(contentId)) {
      throw badRequest(
        'entrada-invalida',
        'O identificador de conteúdo só pode ter letras, números, ponto, dois-pontos, hífen e sublinhado.',
      );
    }
  }

  return {
    functionId: functionId as AiRequest['functionId'],
    channelId,
    input: input as Record<string, unknown>,
    ...(typeof note === 'string' ? { note } : {}),
    ...(typeof contentId === 'string' ? { contentId } : {}),
  };
}

/* =============================================================================
   Regras que o JSON Schema não expressa
   ============================================================================= */

/**
 * Coerência interna da resposta.
 *
 * O `rebeca-qa` apontou o furo: o prompt de `revisar-infantil` **exige** que achado de gravidade alta
 * implique `bloqueante: true`, e que `bloqueante: true` implique `adequado: false` — mas nada disso
 * estava no contrato. Resultado: o modelo podia devolver `{adequado: true, bloqueante: true}` e a
 * validação aprovava. Regra que só existe em prosa não é gate; é pedido.
 *
 * Aqui as regras do prompt viram verificação executável. Elas entram na mesma lista de erros do
 * schema, então uma resposta incoerente dispara a tentativa de correção — e falha alto se persistir,
 * em vez de chegar ao humano com a contradição dentro.
 */
export function semanticErrors(functionId: string, data: unknown): string[] {
  const errors: string[] = [];
  if (typeof data !== 'object' || data === null) return errors;
  const record = data as Record<string, unknown>;

  const achados = Array.isArray(record['achados']) ? (record['achados'] as unknown[]) : [];
  const temAchadoAlto = achados.some(
    (item) =>
      typeof item === 'object' &&
      item !== null &&
      (item as Record<string, unknown>)['gravidade'] === 'alta',
  );

  if (functionId === 'revisar-infantil') {
    const bloqueante = record['bloqueante'];
    const adequado = record['adequado'];

    if (bloqueante === true && adequado === true) {
      errors.push(
        '$.adequado: não pode ser verdadeiro quando "bloqueante" é verdadeiro — conteúdo bloqueante não é adequado para a faixa',
      );
    }
    if (temAchadoAlto && bloqueante !== true) {
      errors.push('$.bloqueante: tem de ser verdadeiro quando existe achado de gravidade "alta"');
    }
  }

  if (functionId === 'revisar-qualidade') {
    const veredito = record['veredito'];

    if (temAchadoAlto && veredito === 'aprovavel') {
      errors.push('$.veredito: não pode ser "aprovavel" com achado de gravidade "alta"');
    }

    const rubrica = record['rubrica'];
    if (typeof rubrica === 'object' && rubrica !== null) {
      const notas = Object.values(rubrica as Record<string, unknown>).filter(
        (value): value is number => typeof value === 'number',
      );
      if (veredito === 'aprovavel' && notas.some((nota) => nota <= 40)) {
        errors.push('$.veredito: não pode ser "aprovavel" com nota de rubrica ≤ 40');
      }
    }
  }

  return errors;
}

/* =============================================================================
   Escolha do modelo
   ============================================================================= */

interface ModelChoice {
  readonly provider: ProviderId;
  readonly model: string;
  readonly entry: ModelEntry | null;
  /** Por que este fornecedor foi escolhido — vira diagnóstico e texto na tela de configuração. */
  readonly reason: string;
  /** De onde veio a escolha. `catalogo` = nenhuma sobreposição. */
  readonly source: 'funcao' | 'nivel' | 'ambiente' | 'catalogo' | 'simulacao';
}

/**
 * As três decisões que o produto exige que sejam **explícitas do dono**, e não padrão silencioso.
 *
 * Valem por configuração salva na tela **ou** por variável de ambiente, nessa ordem: quem acabou de
 * ligar a chave na interface espera que ela valha sem reiniciar o servidor.
 */
function policyFlags(): {
  allowUnverifiedMinor: boolean;
  allowUnpriced: boolean;
  allowNoLedger: boolean;
} {
  const config = loadConfig();
  return {
    allowUnverifiedMinor:
      config.allowUnverifiedMinorPolicy || allowUnverifiedMinorPolicy(),
    allowUnpriced: config.allowUnpricedModel || allowUnpricedModel(),
    allowNoLedger: config.allowNoLedger || process.env.REBECA_ALLOW_NO_LEDGER === '1',
  };
}

/** Aplica uma sobreposição `provider:model` às regras de preço e de canal. Lança quando ela viola. */
function choiceFromSpec(
  spec: string,
  channel: ServerChannel,
  source: ModelChoice['source'],
  origin: string,
): ModelChoice {
  const separator = spec.indexOf(':');
  const provider = spec.slice(0, separator).trim();
  const model = spec.slice(separator + 1).trim();

  if (provider === 'simulado') {
    return {
      provider: 'simulado',
      model: model || 'simulado',
      entry: null,
      reason: `forçado em ${origin}`,
      source: 'simulacao',
    };
  }

  // `PROVIDER_ENV` é o mapa completo de fornecedores reais. Checar contra `PROVIDERS` (que só tem os
  // do dialeto `chat/completions`) fazia uma sobreposição para Anthropic ou Google ser **ignorada em
  // silêncio** — o pedido caía no catálogo padrão sem o dono do produto entender por quê.
  if (!(provider in PROVIDER_ENV) || model.length === 0) {
    throw new AiError(
      {
        code: 'entrada-invalida',
        message: `A escolha de modelo em ${origin} está em formato inválido. Use "provedor:modelo".`,
        detail: `recebido: ${spec}`,
        retryable: false,
      },
      400,
    );
  }

  const typed = provider as RealProviderId;
  const entry = findModelEntry(typed, model);
  const flags = policyFlags();

  // Modelo sem preço verificado não pode ser chamado: sem preço não há estimativa, e sem estimativa a
  // trava por chamada não se aplica — a chamada sairia sem teto. Recusar protege o invariante nº 4.
  if (!entry && !flags.allowUnpriced) {
    throw new AiError(
      {
        code: 'nao-autorizado',
        message:
          `O modelo escolhido em ${origin} não está na tabela de preços, então o teto de gasto não pode ser aplicado a ele. ` +
          'Escolha um modelo da lista, ou assuma o risco explicitamente na tela de Configurações.',
        detail: `modelo sem preço verificado: ${typed}:${model}`,
        retryable: false,
      },
      403,
    );
  }

  const allowed = entry
    ? isAllowedForChannel(entry.minorPolicy, channel.childDirected, {
        allowUnverified: flags.allowUnverifiedMinor,
      })
    : true;

  if (!allowed) {
    // Sobreposição explícita que viola a allow-list do canal infantil: recusar em vez de obedecer em
    // silêncio. A decisão é do humano, e precisa ser registrada — não contornada pelo agente.
    throw new AiError(
      {
        code: 'nao-autorizado',
        message:
          `O modelo escolhido em ${origin} não é permitido para este canal, cujo conteúdo é dirigido a crianças. ` +
          'Escolha outro modelo ou registre a decisão na tela de Configurações.',
        detail: `modelo ${model} (${entry?.minorPolicy ?? 'desconhecido'}) bloqueado pelo gate de canal infantil`,
        retryable: false,
      },
      403,
    );
  }

  return {
    provider: typed,
    model,
    entry,
    reason: entry
      ? `definido em ${origin}`
      : `definido em ${origin} — modelo fora do catálogo, custo NÃO VERIFICADO e sem teto por chamada`,
    source,
  };
}

/**
 * Resolve `provider:model` para uma **função** e um canal.
 *
 * Ordem de precedência, do mais específico ao mais genérico:
 *
 *   1. modelo da **função** (tela de Configurações)
 *   2. modelo do **nível** da função (tela de Configurações)
 *   3. `REBECA_MODEL_<NÍVEL>` (variável de ambiente)
 *   4. padrão do **catálogo** para o nível, no primeiro fornecedor com chave que seja permitido
 *   5. simulação
 *
 * Os passos 1 e 2 existem para "diferenciar cada LLM": o nível agrupa funções por tipo de trabalho, e
 * a sobreposição por função atende o caso em que uma delas precisa de outro modelo.
 *
 * Devolver `simulado` em vez de lançar erro no fim é deliberado: o produto continua utilizável, e a
 * tela mostra que está em simulação. Recusar tudo sem chave tornaria o app inútil para quem ainda não
 * contratou fornecedor.
 */
function chooseModel(tier: AiTier, channel: ServerChannel, functionId: AiFunctionId): ModelChoice {
  const config = loadConfig();

  const perFunction = config.functionModels[functionId];
  if (perFunction) {
    return choiceFromSpec(perFunction, channel, 'funcao', `a função "${functionId}"`);
  }

  const perTier = config.models[tier];
  if (perTier) {
    return choiceFromSpec(perTier, channel, 'nivel', `o nível "${tier}"`);
  }

  const fromEnv = (process.env[`REBECA_MODEL_${tier.toUpperCase()}`] ?? '').trim();
  if (fromEnv) {
    return choiceFromSpec(fromEnv, channel, 'ambiente', `REBECA_MODEL_${tier.toUpperCase()}`);
  }

  for (const provider of providerOrder()) {
    if (providerKey(provider).length === 0) continue;
    const entry = defaultModelFor(tier, provider);
    if (!entry) continue;
    const allowed = isAllowedForChannel(entry.minorPolicy, channel.childDirected, {
      allowUnverified: policyFlags().allowUnverifiedMinor,
    });
    if (!allowed) continue;
    return {
      provider,
      model: entry.model,
      entry,
      reason: `padrão do catálogo para o nível "${tier}"`,
      source: 'catalogo',
    };
  }

  return {
    provider: 'simulado',
    model: 'simulado',
    entry: null,
    reason: 'nenhum fornecedor com chave é permitido para este canal',
    source: 'simulacao',
  };
}

/* =============================================================================
   Chamada
   ============================================================================= */

interface AttemptAccumulator {
  tokensIn: number;
  tokensOut: number;
}

export interface HandleOptions {
  /** Injetado nos testes para fixar o "agora" (preço de pico da DeepSeek e data do livro). */
  readonly now?: Date;
  /** Injetado nos testes para observar a chamada sem rede. */
  readonly transport?: (call: {
    provider: ProviderId;
    model: string;
    system: string;
    user: string;
    maxOutputTokens: number;
    apiKey: string;
    jsonSchema: unknown;
    signal: AbortSignal;
  }) => Promise<{ raw: string; tokensIn: number; tokensOut: number }>;
}

/**
 * Remove do detalhe técnico qualquer coisa com cara de credencial.
 *
 * Os adaptadores já constroem mensagens seguras, mas **nem toda exceção passa por eles**: uma falha
 * de rede, um erro do runtime ou um defeito num adaptador podem carregar a URL da requisição (e a
 * chave vai na URL em alguns provedores) ou ecoar um cabeçalho. Esta função é a segunda linha de
 * defesa — e o teste `handler.test.ts` prova que ela funciona, plantando a chave dentro do erro.
 */
export function redact(text: string): string {
  return text
    .replace(/(bearer\s+)[A-Za-z0-9._\-]+/gi, '$1[removido]')
    .replace(/((?:api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|key|token|secret)\s*[=:]\s*)[A-Za-z0-9._\-]+/gi, '$1[removido]')
    .replace(/\b(?:sk|pk|AIza|ghp|xoxb|glpat)-[A-Za-z0-9._\-]{6,}\b/g, '[removido]')
    // Sequência longa sem espaço: cobre chave colada em texto que não casa com os padrões acima.
    .replace(/[A-Za-z0-9._\-]{40,}/g, '[removido]');
}

export async function handleGenerate(body: unknown, options: HandleOptions = {}): Promise<AiResult> {
  const now = options.now ?? new Date();
  // Medido com relógio monotônico, não com `Date`: diferença de `Date` pode até ser negativa se o
  // relógio da máquina for ajustado durante a chamada, e latência negativa no painel é ruído puro.
  const startedAt = performance.now();
  const request = parseRequest(body);

  const spec = getAiFunction(request.functionId);
  if (!spec) {
    throw badRequest('funcao-desconhecida', 'Esta função não existe no produto.');
  }

  const channel = findServerChannel(request.channelId);
  if (!channel) {
    // Mesma mensagem para "não existe" e "não é seu": não se confirma a existência de canal alheio.
    throw badRequest('canal-desconhecido', 'Canal não encontrado.');
  }

  // Função de gate infantil só existe para canal infantil. Chamar em canal adulto é erro de uso, e
  // recusar é mais honesto do que produzir um parecer sem sentido.
  if (spec.childChannelOnly && !channel.childDirected) {
    throw badRequest(
      'entrada-invalida',
      'Esta checagem só se aplica a canal cujo conteúdo é dirigido a crianças.',
    );
  }

  // --- validação da entrada -------------------------------------------------
  const schemas = getFunctionSchema(spec.id);
  if (!schemas) {
    throw new AiError(
      {
        code: 'entrada-invalida',
        message: 'A função está registrada sem contrato de entrada. Isto é defeito de configuração.',
        detail: `sem schema para ${spec.id}`,
        retryable: false,
      },
      500,
    );
  }

  const inputErrors = validateSchema(schemas.input, request.input);
  if (inputErrors.length > 0) {
    throw badRequest('entrada-invalida', 'A entrada da função não está no formato esperado.', inputErrors.slice(0, 8).join(' | '));
  }

  const serializedInput = JSON.stringify(request.input);
  if (serializedInput.length > AI_LIMITS.maxInputChars) {
    throw badRequest(
      'entrada-invalida',
      `A entrada passou do limite de ${AI_LIMITS.maxInputChars} caracteres.`,
    );
  }

  const prompt = PROMPTS[spec.promptId];
  if (!prompt) {
    throw new AiError(
      {
        code: 'entrada-invalida',
        message: 'O prompt desta função não foi encontrado. Isto é defeito de configuração.',
        detail: `prompt ausente: ${spec.promptId}`,
        retryable: false,
      },
      500,
    );
  }

  // --- escolha do modelo e trava de custo -----------------------------------
  const choice = chooseModel(spec.tier, channel);
  const maxOutputTokens = outputTokenBudget(choice.entry, Math.min(spec.maxOutputTokens, prompt.maxOutputTokens));

  const built = buildMessages({
    prompt,
    channelId: channel.id,
    channelName: channel.name,
    input: request.input,
    note: request.note,
  });

  const isSimulated = choice.provider === 'simulado';

  if (!isSimulated) {
    /*
     * O teto DIÁRIO depende de ler quanto já foi gasto. Onde o livro de custos não é durável — a
     * função serverless da Vercel, cujo sistema de arquivos é somente-leitura — o gasto de invocações
     * anteriores simplesmente não existe: cada processo nasce zerado.
     *
     * Efeito medido pelo `rebeca-qa`: sem livro durável, N chamadas caras em processos distintos
     * passam todas, e o painel informa um gasto que não é o gasto. Chamar isso de "teto de US$ 1,00"
     * seria uma garantia falsa justamente onde o dinheiro corre.
     *
     * A resposta honesta é recusar a geração paga quando a trava não pode ser aplicada, e dizer o que
     * fazer. Quem quiser operar assim assume a decisão em `REBECA_ALLOW_NO_LEDGER=1` — o mesmo padrão
     * dos outros dois escapes deste arquivo: default seguro, decisão explícita e registrada.
     */
    if (ledgerPath() === null && process.env.REBECA_ALLOW_NO_LEDGER !== '1') {
      throw new AiError(
        {
          code: 'nao-autorizado',
          message:
            'Neste ambiente não há onde registrar o custo de forma durável, então o teto diário de gasto não pode ser aplicado. ' +
            'A geração paga fica indisponível aqui até existir memória durável (banco) — ou até a decisão explícita em REBECA_ALLOW_NO_LEDGER=1.',
          detail: 'livro de custos não durável neste ambiente (sem sistema de arquivos gravável)',
          retryable: false,
        },
        403,
      );
    }

    const estimate = estimateCostUsd(
      choice.entry,
      built.system.length + built.user.length,
      maxOutputTokens,
      now,
    );

    if (estimate !== null && estimate > AI_LIMITS.perCallUsd) {
      throw new AiError(
        {
          code: 'teto-por-chamada',
          message: `Esta chamada custaria cerca de US$ ${estimate.toFixed(3)}, acima do teto de US$ ${AI_LIMITS.perCallUsd.toFixed(2)} por chamada. Nada foi enviado ao provedor.`,
          detail: `estimativa ${estimate.toFixed(4)} USD com ${maxOutputTokens} tokens de saída`,
          retryable: false,
        },
        402,
      );
    }

    const spent = spentTodayUsd(todayLocal(now));
    if (spent + (estimate ?? 0) > AI_LIMITS.dailyUsd) {
      throw new AiError(
        {
          code: 'teto-diario',
          message: `O teto diário de US$ ${AI_LIMITS.dailyUsd.toFixed(2)} foi atingido (já gasto: US$ ${spent.toFixed(3)}). Nada foi enviado ao provedor.`,
          detail: 'teto diário aprovado pelo dono do produto nesta sessão',
          retryable: true,
        },
        402,
      );
    }
  }

  // --- execução com uma tentativa de correção -------------------------------
  const accumulator: AttemptAccumulator = { tokensIn: 0, tokensOut: 0 };
  let raw = '';
  let attempts = 0;
  let validationErrors: string[] = [];

  try {
    for (let attempt = 1; attempt <= AI_LIMITS.maxAttempts; attempt += 1) {
      attempts = attempt;

      const messages =
        attempt === 1
          ? built
          : buildMessages({
              prompt,
              channelId: channel.id,
              channelName: channel.name,
              input: request.input,
              note: request.note,
              repairErrors: validationErrors,
            });

      const response = isSimulated
        ? simulate(spec.id, {
            channelId: channel.id,
            channelName: channel.name,
            childDirected: channel.childDirected,
            ageRange: channel.ageRange,
            input: request.input,
            note: request.note,
          })
        : await callProvider(choice, messages, maxOutputTokens, schemas.output, options);

      accumulator.tokensIn += response.tokensIn;
      accumulator.tokensOut += response.tokensOut;
      raw = response.raw;

      const parsed = extractJson(raw);
      const outputErrors = [...validateSchema(schemas.output, parsed), ...semanticErrors(spec.id, parsed)];
      if (outputErrors.length === 0) {
        validationErrors = [];
        break;
      }
      validationErrors = outputErrors;

      if (attempt === AI_LIMITS.maxAttempts) {
        throw new AiError(
          {
            code: 'schema-invalido',
            message:
              'A resposta não passou na validação do contrato e a correção automática não resolveu. Nada foi aproveitado.',
            detail: outputErrors.slice(0, 6).join(' | '),
            retryable: true,
          },
          502,
        );
      }
    }

    const parsed = extractJson(raw);
    const usage: AiUsage = { tokensIn: accumulator.tokensIn, tokensOut: accumulator.tokensOut };
    const { costUsd, costSource } = computeCost(choice.entry, usage, now);

    // Custo não verificado vai para o livro como **célula vazia**, não como `0.000000`. Zero é uma
    // afirmação ("não custou"); vazio é a verdade ("não sei"). O painel de negócio lê este arquivo, e
    // um zero falso ali vira decisão errada — o `rebeca-qa` levantou exatamente isso.
    const ledgerCostUsd = costSource === 'real' ? costUsd : null;

    // Simulação não gasta dinheiro: não entra no livro de custos. Registrar uma linha de custo zero
    // por simulação faria o livro responder errado a "quantas gerações pagas tivemos?".
    const costRecorded: 'csv' | 'memoria' | 'nenhum' = isSimulated
      ? 'nenhum'
      : recordCost({
          canal: channel.name,
          conteudo: request.contentId ?? '—',
          etapa: spec.stage,
          provedor: choice.provider,
          modelo: choice.model,
          tokensIn: usage.tokensIn,
          tokensOut: usage.tokensOut,
          custoUsd: ledgerCostUsd,
          tempoMin: 0,
          promptId: `${spec.promptId}@v${spec.promptVersion}`,
          data: todayLocal(now),
        });

    return {
      functionId: spec.id,
      channelId: channel.id,
      promptId: spec.promptId,
      promptVersion: spec.promptVersion,
      tier: spec.tier,
      provider: isSimulated ? 'simulado' : choice.provider,
      model: choice.model,
      simulated: isSimulated,
      data: parsed,
      usage,
      costUsd,
      costSource,
      costRecorded,
      latencyMs: Math.max(0, Math.round(performance.now() - startedAt)),
      createdAt: now.toISOString(),
      attempts,
    };
  } catch (error) {
    // Custo de tentativa que falhou **também é custo**: o provedor respondeu e cobrou. Registrar só
    // o sucesso produziria custo fantasma — exatamente o que o invariante nº 4 existe para impedir.
    if (!isSimulated && accumulator.tokensIn + accumulator.tokensOut > 0) {
      const { costUsd: failedCostUsd, costSource: failedSource } = computeCost(choice.entry, accumulator, now);
      recordCost({
        canal: channel.name,
        conteudo: request.contentId ?? '—',
        etapa: spec.stage,
        provedor: choice.provider,
        modelo: choice.model,
        tokensIn: accumulator.tokensIn,
        tokensOut: accumulator.tokensOut,
        custoUsd: failedSource === 'real' ? failedCostUsd : null,
        tempoMin: 0,
        promptId: `${spec.promptId}@v${spec.promptVersion} (falhou)`,
        data: todayLocal(now),
      });
    }

    // Erro conhecido já vem com mensagem em pt-BR. O **detalhe**, porém, não é de confiança por
    // construção: ele nasce do corpo de erro do provedor (`safeProviderMessage` em `providers.ts`,
    // e o caminho equivalente em `providers-extra.ts`), e uma API pode ecoar o cabeçalho
    // `Authorization` na própria mensagem de erro. `AiError.toBody()` entrega o `detail` ao
    // navegador (`server/ai/http.ts`), então reemitir o erro sem filtro **devolve a chave ao
    // cliente**. O filtro é aplicado aqui, no ponto de saída, de propósito: vale para todo adaptador
    // — inclusive os que ainda não existem — e não só para o ramo de erro inesperado logo abaixo.
    //
    // O furo foi provado antes da correção: `src/ai/__tests__/vazamento-provedor.test.ts` mostra a
    // chave atravessando pelo caminho real do adaptador OpenAI. O teste que existia não pegava,
    // porque plantava um `Error` comum (que cai no ramo de baixo, este sim filtrado).
    if (error instanceof AiError) {
      throw new AiError(
        {
          code: error.code,
          message: redact(error.message),
          ...(error.detail === undefined ? {} : { detail: redact(error.detail) }),
          retryable: error.retryable,
        },
        error.status,
      );
    }

    // Erro inesperado (rede, runtime, defeito de adaptador) pode carregar URL com chave ou ecoar
    // cabeçalho. Aqui ele é convertido em erro do domínio com o detalhe **higienizado** — a interface
    // nunca recebe texto cru de provedor.
    throw new AiError(
      {
        code: 'provedor',
        message:
          'A geração falhou antes de produzir conteúdo. Nada foi gerado e nada foi publicado.',
        detail: redact(error instanceof Error ? error.message : 'erro sem mensagem legível'),
        retryable: true,
      },
      502,
    );
  }
}

async function callProvider(
  choice: ModelChoice,
  messages: { system: string; user: string },
  maxOutputTokens: number,
  jsonSchema: unknown,
  options: HandleOptions,
): Promise<{ raw: string; tokensIn: number; tokensOut: number }> {
  if (choice.provider === 'simulado') {
    throw new AiError(
      { code: 'sem-provedor', message: 'Nenhum provedor disponível.', retryable: false },
      500,
    );
  }

  const apiKey = providerKey(choice.provider);
  if (apiKey.length === 0) {
    throw new AiError(
      {
        code: 'sem-provedor',
        message: 'A chave do provedor não está configurada no servidor.',
        detail: `variável ausente: ${PROVIDER_ENV[choice.provider]}`,
        retryable: false,
      },
      503,
    );
  }

  if (options.transport) {
    return options.transport({
      provider: choice.provider,
      model: choice.model,
      system: messages.system,
      user: messages.user,
      maxOutputTokens,
      apiKey,
      jsonSchema,
      signal: AbortSignal.timeout(AI_LIMITS.requestTimeoutMs),
    });
  }

  // Anthropic e Google têm dialeto próprio; OpenAI, DeepSeek e OpenRouter compartilham o adaptador
  // no formato `chat/completions`. A escolha é por identificador — nunca por "o adaptador mais
  // parecido".
  const providerId = choice.provider;
  const activeAdapter =
    providerId === 'anthropic'
      ? (await import('./providers-extra')).ANTHROPIC_PROVIDER
      : providerId === 'google'
        ? (await import('./providers-extra')).GOOGLE_PROVIDER
        : PROVIDERS[providerId];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_LIMITS.requestTimeoutMs);
  try {
    return await activeAdapter.complete({
      model: choice.model,
      system: messages.system,
      user: messages.user,
      maxOutputTokens,
      // O schema de saída vai ao provedor quando ele souber usar (OpenAI, Anthropic, Google) e é
      // ignorado quando não souber (DeepSeek, OpenRouter) — a validação local decide de qualquer
      // forma, então enviar é ganho, nunca dependência.
      jsonSchema: (jsonSchema as Parameters<typeof activeAdapter.complete>[0]['jsonSchema']) ?? null,
      signal: controller.signal,
      apiKey,
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Custo real a partir do `usage` do provedor.
 *
 * `nao-verificado` quando:
 * - o modelo não está no catálogo (não há preço com fonte), **ou**
 * - a resposta não trouxe contagem de tokens legível.
 *
 * O segundo caso importa: devolver `0` e chamar de "custo real" seria um falso verde no invariante
 * nº 4 — o painel mostraria custo zero para uma geração que foi cobrada.
 */
function computeCost(
  entry: ModelEntry | null,
  usage: AiUsage,
  now: Date,
): { costUsd: number; costSource: 'real' | 'nao-verificado' } {
  if (!entry) return { costUsd: 0, costSource: 'nao-verificado' };
  if (usage.tokensIn <= 0 && usage.tokensOut <= 0) return { costUsd: 0, costSource: 'nao-verificado' };
  const price = effectivePrice(entry, now);
  return { costUsd: priceTokens(usage.tokensIn, usage.tokensOut, price), costSource: 'real' };
}

/* =============================================================================
   Estado do provedor (tela de Configurações)
   ============================================================================= */

export function handleStatus(now: Date = new Date()): AiStatus {
  const order = providerOrder();
  const providers = order.map((provider) => {
    const entry = defaultModelFor('raciocinio', provider);
    const policy = entry?.minorPolicy ?? 'nao-verificado';
    return {
      provider,
      configured: providerKey(provider).length > 0,
      envVar: PROVIDER_ENV[provider],
      minorPolicy: policy,
      allowedForChildDirected: isAllowedForChannel(policy, true, {
        allowUnverified: allowUnverifiedMinorPolicy(),
      }),
    };
  });

  // Dois canais sintéticos: um dirigido a crianças e um não. A comparação entre os dois é o que
  // torna visível, na tela de configuração, que a allow-list por canal está de fato em vigor.
  const adultChannel: ServerChannel = {
    id: '__(adulto)__',
    name: 'Canal de referência (não infantil)',
    niche: '',
    childDirected: false,
    ageRange: null,
  };
  const childChannel: ServerChannel = {
    id: '__(infantil)__',
    name: 'Canal de referência (infantil)',
    niche: '',
    childDirected: true,
    ageRange: null,
  };

  const tiers: AiTier[] = ['raciocinio', 'criativo', 'rapido', 'visao'];
  const models = {} as Record<AiTier, string>;
  const childDirectedModels = {} as Record<AiTier, string>;
  for (const tier of tiers) {
    const adult = chooseModelQuietly(tier, adultChannel);
    const child = chooseModelQuietly(tier, childChannel);
    models[tier] = adult;
    childDirectedModels[tier] = child;
  }

  const path = ledgerPath();
  const anyConfigured = providers.some((provider) => provider.configured);
  const childSimulated = Object.values(childDirectedModels).every((value) => value.startsWith('simulado:'));

  return {
    ready: true,
    hasAnyKey: anyConfigured,
    simulated: !anyConfigured || childSimulated,
    providers,
    models,
    childDirectedModels,
    childDirectedFallsBackToSimulation: childSimulated,
    policyOverride: allowUnverifiedMinorPolicy(),
    budget: {
      perCallUsd: AI_LIMITS.perCallUsd,
      dailyUsd: AI_LIMITS.dailyUsd,
      spentTodayUsd: spentTodayUsd(todayLocal(now)),
      ledger: path ? 'csv' : 'memoria',
      ledgerPath: ledgerDisplayPath(),
    },
  };
}

/** Igual a `chooseModel`, mas nunca lança — usado só para montar o painel de status. */
function chooseModelQuietly(tier: AiTier, channel: ServerChannel): string {
  try {
    const choice = chooseModel(tier, channel);
    return `${choice.provider}:${choice.model}`;
  } catch (error) {
    // Um override recusado **não** cai no provedor padrão: a chamada falha. Dizer "simulado" aqui
    // faria o painel mentir sobre o que vai acontecer quando o usuário clicar em gerar.
    const detail = error instanceof AiError ? error.detail : undefined;
    return `recusado: ${detail ?? 'configuração de modelo inválida'}`;
  }
}
