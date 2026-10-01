/**
 * Tetos de custo e alvos de render do pipeline de mídia.
 *
 * **Estes números não são escolha de agente.** Foram aprovados pelo dono do produto em 2026-10-01 e
 * estão registrados no `ADR-005` (aceito):
 *
 * | Decisão | Valor | Significado |
 * |---|---|---|
 * | D2 | **US$ 12,00 por minuto** de vídeo | teto que **para** o pipeline, não preço esperado |
 * | D5 | **US$ 60,00 por mês** | ≈ 1 episódio de 7 min: "validar qualidade antes de escalar" |
 *
 * Ficam em `src/media/` (e não em `server/media/`) pelo mesmo motivo da camada de IA: a tela precisa
 * conhecer o teto para mostrar quanto falta, e o servidor aplica a mesma trava de novo. A do cliente é
 * conveniência; a do servidor é a que vale.
 *
 * **Por que não são variável de ambiente (padrão D12):** teto que se muda por `export` no terminal é
 * teto que ninguém revisou. Mudar limite de gasto exige revisão de código — de propósito.
 */

import type { RenderSpec } from './contract.js';

export interface MediaLimits {
  /** D2 — teto de custo por minuto do **arquivo renderizado** (medido por ffprobe, não por `tempo_min`). */
  readonly perMinuteUsd: number;
  /** D5 — limite de gasto do mês corrente, somado de `.rebeca/custos.csv`. */
  readonly monthlyUsd: number;
  /** Quem aprovou os dois números. Vai para o `meta.json`: o gasto tem de ser auditável com o teto. */
  readonly approvedBy: string;
  readonly approvedAt: string;
  /** Duração máxima do Short, em segundos. A spec do canal pode reduzir, nunca aumentar sem revisão. */
  readonly shortMaxSeconds: number;
}

export const MEDIA_LIMITS: MediaLimits = {
  perMinuteUsd: 12.0,
  monthlyUsd: 60.0,
  approvedBy: 'humano:dono-do-produto',
  approvedAt: '2026-10-01',
  shortMaxSeconds: 45,
};

/**
 * Alvo de loudness.
 *
 * `verified: false` é o campo mais importante deste bloco: **o valor exigido pela plataforma não foi
 * conferido na documentação oficial nesta sessão**. −14 LUFS é o alvo **declarado** (é o número que o
 * próprio YouTube publica para conteúdo normalizado, mas isso precisa ser lido na fonte antes de virar
 * requisito). Enquanto `verified` for `false`, ninguém pode tratar o número como exigência cumprida.
 */
export const LOUDNESS_TARGET = {
  integratedLufs: -14.0,
  truePeakDb: -1.5,
  lra: 11.0,
  /** Trilha de fundo a 25% da narração — inteligibilidade da fala acima de estética. */
  musicGain: 0.25,
  verified: false as const,
  note:
    'NÃO VERIFICADO: o valor exigido pela plataforma (loudness/true peak/duração) não foi conferido na ' +
    'documentação oficial do YouTube nesta sessão. −14 LUFS entra apenas como ALVO DECLARADO. Conferir em ' +
    'https://support.google.com/youtube/answer/9147770 (ou doc vigente) antes de tratar como requisito.',
} as const;

/** 1920×1080 a 30 fps — o longo. Os valores são os da skill: formato é contrato, não preferência. */
export const LONG_RENDER_SPEC: RenderSpec = {
  profile: 'longo-16x9',
  width: 1920,
  height: 1080,
  fps: 30,
  videoCodec: 'libx264',
  crf: 18,
  preset: 'medium',
  pixelFormat: 'yuv420p',
  audioCodec: 'aac',
  audioBitrate: '192k',
  audioSampleRate: 48_000,
  faststart: true,
  loudness: {
    integratedLufs: LOUDNESS_TARGET.integratedLufs,
    truePeakDb: LOUDNESS_TARGET.truePeakDb,
    lra: LOUDNESS_TARGET.lra,
  },
  musicGain: LOUDNESS_TARGET.musicGain,
};

/**
 * 1080×1920 — o Short.
 *
 * O recorte é do **mesmo material** do longo (`crop=ih*9/16:ih,scale=1080:1920`), não um segundo render
 * independente: assim o Short não pode divergir do vídeo aprovado, e não se paga duas vezes pelo mesmo
 * material. O preset cai para `veryfast` porque o Short é derivado, não material de origem.
 */
export const SHORT_RENDER_SPEC: RenderSpec = {
  ...LONG_RENDER_SPEC,
  profile: 'short-9x16',
  width: 1080,
  height: 1920,
  preset: 'veryfast',
};

export const RENDER_SPECS: Readonly<Record<RenderSpec['profile'], RenderSpec>> = {
  'longo-16x9': LONG_RENDER_SPEC,
  'short-9x16': SHORT_RENDER_SPEC,
};

/** 1/30 s em ms. Usado para quantizar a timeline em quadros inteiros. */
export function frameDurationMs(fps: number): number {
  return 1000 / fps;
}

/**
 * Erro dos portões de gasto.
 *
 * Tem `code` próprio e mensagem em pt-BR porque **quem lê isso é o humano que vai decidir** se aumenta o
 * teto ou reduz o escopo. Erro genérico de pipeline não diz a ninguém o que fazer.
 */
export class MediaBudgetError extends Error {
  readonly code: 'teto-por-minuto' | 'teto-mensal' | 'custo-invalido' | 'estimativa-obrigatoria';

  constructor(code: MediaBudgetError['code'], message: string) {
    super(message);
    this.name = 'MediaBudgetError';
    this.code = code;
  }
}

/**
 * Custo por minuto **do arquivo renderizado**.
 *
 * A duração tem de vir do `ffprobe` do render, nunca de `tempo_min` do livro de custos — `tempo_min` é
 * quanto tempo a geração levou, não quanto dura o vídeo. Trocar os dois faz o custo por minuto parecer
 * baixo justamente quando o render ficou rápido.
 *
 * Custo `0` é resposta legítima (Fase 0 com ffmpeg local custa zero de verdade): devolve `0`, não `NaN`
 * e não célula vazia. Duração ausente ou custo negativo/`NaN` **lançam** — inventar número aqui é o
 * defeito que a coluna vazia do livro existe para evitar.
 */
export function usdPerMinute(costUsd: number, durationMs: number): number {
  if (!Number.isFinite(costUsd) || costUsd < 0) {
    throw new MediaBudgetError(
      'custo-invalido',
      `Custo inválido para calcular USD por minuto: ${String(costUsd)}. Use o custo real do provedor, não um número inventado.`,
    );
  }
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    throw new MediaBudgetError(
      'custo-invalido',
      `Duração inválida para calcular USD por minuto: ${String(durationMs)} ms. A duração tem de vir do arquivo renderizado (ffprobe).`,
    );
  }
  return costUsd / (durationMs / 60_000);
}

export function formatUsd(value: number): string {
  return `US$ ${value.toFixed(4)}`;
}

/** Os tetos como dado serializável, para entrarem no `meta.json` junto do gasto. */
export interface MediaLimitsSnapshot {
  readonly tetoPorMinutoUsd: number;
  readonly limiteMensalUsd: number;
  readonly aprovadoPor: string;
  readonly aprovadoEm: string;
  readonly loudnessAlvo: {
    readonly integratedLufs: number;
    readonly truePeakDb: number;
    readonly lra: number;
    readonly verificado: boolean;
    readonly nota: string;
  };
}

export function limitsSnapshot(): MediaLimitsSnapshot {
  return {
    tetoPorMinutoUsd: MEDIA_LIMITS.perMinuteUsd,
    limiteMensalUsd: MEDIA_LIMITS.monthlyUsd,
    aprovadoPor: MEDIA_LIMITS.approvedBy,
    aprovadoEm: MEDIA_LIMITS.approvedAt,
    loudnessAlvo: {
      integratedLufs: LOUDNESS_TARGET.integratedLufs,
      truePeakDb: LOUDNESS_TARGET.truePeakDb,
      lra: LOUDNESS_TARGET.lra,
      verificado: LOUDNESS_TARGET.verified,
      nota: LOUDNESS_TARGET.note,
    },
  };
}

/* =============================================================================
   Portões
   ============================================================================= */

/**
 * Portão (a): o custo por minuto do episódio ultrapassou o teto D2?
 *
 * Chamado **antes** de gerar (com o custo estimado pelo provedor) e **depois** de medir o render (com o
 * custo real e a duração do arquivo). Trava que só existe depois de pagar é relatório, não trava — por
 * isso a mesma função serve aos dois momentos: ela não sabe se o número é estimativa ou medição, só
 * cobra o teto.
 *
 * Teto é limite **inclusivo**: exatamente US$ 12,00/min passa. "Ultrapassar" é estritamente maior.
 */
export function assertEpisodeWithinBudget(input: {
  readonly costUsd: number;
  readonly durationMs: number;
  readonly limits?: MediaLimits;
  /** `estimado` aparece na mensagem: o humano precisa saber se o gasto já ocorreu. */
  readonly source?: 'estimado' | 'medido';
}): number {
  const limits = input.limits ?? MEDIA_LIMITS;
  const rate = usdPerMinute(input.costUsd, input.durationMs);

  if (rate > limits.perMinuteUsd) {
    const origem = input.source === 'estimado' ? 'estimado' : 'medido';
    throw new MediaBudgetError(
      'teto-por-minuto',
      `PARE — o custo por minuto do episódio (${origem}) é ${formatUsd(rate)}/min, acima do teto aprovado de ` +
        `${formatUsd(limits.perMinuteUsd)}/min (D2, aprovado em ${limits.approvedAt} por ${limits.approvedBy}). ` +
        'Nada mais será gerado. Reduza o escopo do episódio, troque de provedor dentro da allow-list, ou leve a ' +
        'decisão de aumentar o teto ao humano — o pipeline não aumenta teto sozinho.',
    );
  }

  return rate;
}

/**
 * Portão (b): o gasto do mês ultrapassou o limite D5?
 *
 * `spentUsd` é o que já está em `.rebeca/custos.csv` no mês; `estimateUsd` é o que esta execução
 * pretende gastar. A soma é comparada com o limite, porque o mês já estourado **mais** uma geração nova
 * é exatamente o cenário que o D5 existe para impedir.
 */
export function assertMonthlyWithinBudget(input: {
  readonly spentUsd: number;
  readonly estimateUsd?: number;
  readonly month: string;
  readonly limits?: MediaLimits;
}): number {
  const limits = input.limits ?? MEDIA_LIMITS;
  const estimate = input.estimateUsd ?? 0;

  if (!Number.isFinite(input.spentUsd) || input.spentUsd < 0 || !Number.isFinite(estimate) || estimate < 0) {
    throw new MediaBudgetError(
      'custo-invalido',
      `Gasto do mês inválido (gasto=${String(input.spentUsd)}, estimativa=${String(estimate)}). Sem número confiável o limite não pode ser aplicado.`,
    );
  }

  const projetado = input.spentUsd + estimate;
  if (projetado > limits.monthlyUsd) {
    throw new MediaBudgetError(
      'teto-mensal',
      `PARE — o gasto de ${input.month} chegaria a ${formatUsd(projetado)} ` +
        `(já registrado: ${formatUsd(input.spentUsd)} + esta execução: ${formatUsd(estimate)}), acima do limite mensal ` +
        `aprovado de ${formatUsd(limits.monthlyUsd)} (D5, aprovado em ${limits.approvedAt} por ${limits.approvedBy}). ` +
        'Nada mais será gerado no mês. Leve ao humano: aumentar o limite é decisão dele, e exige revisão de código.',
    );
  }

  return projetado;
}
