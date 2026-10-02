/**
 * Visão de mídia — o que a **tela** precisa saber sobre os arquivos que o pipeline gerou.
 *
 * Por que este arquivo existe:
 *
 * O pipeline da Fase 0 gera arquivos de verdade (imagem, voz, clipe, trilha, render) e grava tudo no
 * manifesto `.rebeca/assets/<canal>/<episodio>/meta.json`. Só que **nada disso chegava à interface**: a
 * camada de dados do app (`src/data/client.ts`) lê o banco de exemplo e não conhece o disco. O dono do
 * produto rodou o pipeline, viu os arquivos gerados — e a tela continuou dizendo *"nenhum vídeo foi
 * gerado ainda"*. Gerou e não apareceu.
 *
 * Este contrato é a ponte que faltava. Ele é deliberadamente **separado** de `contract.ts`: o
 * `contract.ts` é o vocabulário do pipeline (o que os provedores trocam entre si); este é o que
 * atravessa a fronteira servidor→navegador. Misturar os dois faria a tela carregar tipos de provedor
 * que ela não tem o direito de conhecer (invariante nº 7 — provedor é invisível para o usuário).
 *
 * Regras que valem para tudo aqui:
 *
 * 1. **Nada de caminho absoluto.** Só `pathFromAssets` (relativo a `.rebeca/assets`). Caminho absoluto
 *    de máquina na resposta é vazamento de ambiente sem nenhum ganho para a tela.
 * 2. **`simulated` viaja junto, sempre.** É o campo que impede a Fase 0 de se passar por geração real.
 *    Um ativo simulado exibido sem esse rótulo seria mentira de produto — o mesmo defeito que a tela já
 *    teve uma vez, quando listava *"narração e montagem prontas"* com checkmark verde.
 * 3. **`existsOnDisk` é medido, não presumido.** O manifesto pode apontar para um arquivo que sumiu
 *    (pasta limpa, asset movido). Mostrar "gerado" nesse caso é afirmar o que não existe.
 */

import type { MediaKind, MediaStage, AssetReference } from './contract.js';
import type { MediaLimitsSnapshot } from './limits.js';

/**
 * Um ativo do manifesto, como a tela pode mostrá-lo.
 *
 * Todos os campos vêm do `meta.json` — nenhum é recalculado nem estimado aqui. Em particular
 * `durationMs` é a duração **medida** no arquivo (ffprobe) quando ele foi gerado, e `costUsd` é o custo
 * **real** registrado no livro. A Fase 0 grava `0` porque o ffmpeg local custa zero — e `0` é a
 * verdade, não "não verificado".
 */
export interface MediaAssetView {
  readonly stage: MediaStage;
  readonly key: string;
  readonly version: number;
  readonly kind: MediaKind;
  /** Caminho relativo a `.rebeca/assets` — é o que a tela exibe para o humano achar o arquivo. */
  readonly pathFromAssets: string;
  readonly hash: string;
  readonly durationMs: number;
  readonly bytes: number;
  readonly providerId: string;
  readonly model: string;
  readonly promptVersion: string;
  readonly costUsd: number;
  /** `true` = gerado por provedor simulado (ffmpeg local). A tela **tem** de dizer isso. */
  readonly simulated: boolean;
  /** De onde veio a referência visual. Hoje sempre `sintetica`: não existe Character Sheet da Luna. */
  readonly reference: AssetReference;
  readonly approved: boolean;
  readonly recordedAt: string;
  /** O arquivo ainda está no disco? Medido no servidor, no momento da leitura. */
  readonly existsOnDisk: boolean;
}

/** Resumo de um episódio — o suficiente para listar sem abrir o manifesto inteiro na tela. */
export interface MediaEpisodeSummary {
  readonly episodeId: string;
  readonly slug: string;
  readonly updatedAt: string;
  readonly assetCount: number;
  /** Quantos ativos do manifesto **não** foram encontrados no disco. Deve ser 0. */
  readonly missingCount: number;
  readonly totalBytes: number;
  /** Soma das durações medidas. Imagem tem duração 0 (não há o que medir em um PNG). */
  readonly totalDurationMs: number;
  /** Soma do custo **real** registrado por ativo. Na Fase 0 é 0, e isso é a verdade. */
  readonly totalCostUsd: number;
  /** Quantos ativos vieram de provedor simulado. */
  readonly simulatedCount: number;
  /** Maior versão de render encontrada, ou `null` se o episódio não chegou ao render. */
  readonly renderVersion: number | null;
  /** `ausente` enquanto não existir arte oficial do personagem (dívida do `rebeca-branding`). */
  readonly characterSheet: 'ausente' | 'presente';
}

/** O episódio por inteiro, com os tetos que estavam em vigor quando ele foi gerado. */
export interface MediaEpisodeView extends MediaEpisodeSummary {
  readonly channelId: string;
  /** Tetos aprovados (D2/D5) gravados **no manifesto**, não lidos do código de agora. */
  readonly limits: MediaLimitsSnapshot;
  readonly referenciaVisual: {
    readonly characterSheet: 'ausente' | 'presente';
    readonly tipo: AssetReference;
    readonly nota: string;
  };
  readonly assets: readonly MediaAssetView[];
}

/**
 * O que existe de mídia para um canal.
 *
 * `available: false` **não** é erro: é o estado real de um ambiente onde o pipeline nunca rodou. E é o
 * estado de **todo** deploy, porque `.rebeca/assets/` está no `.gitignore` (assets pesados não vão para
 * o git; o Storage escopado por canal é trabalho da F1). A tela precisa dizer isso em vez de mostrar uma
 * lista vazia sem explicação — lista vazia sem motivo é indistinguível de "quebrou".
 */
export interface MediaLibraryView {
  readonly channelId: string;
  readonly available: boolean;
  /** Por que não há mídia para mostrar. `null` quando `available` é `true`. */
  readonly reason: string | null;
  readonly episodes: readonly MediaEpisodeSummary[];
}

/* =============================================================================
   Geração de thumbnail — o que a tela recebe ao pedir arte
   ============================================================================= */

/** Uma opção gerada, como a tela a exibe. */
export interface ThumbnailOptionView {
  readonly optionId: string;
  readonly key: string;
  /** Qual hipótese esta opção testa. Sem isso, "4 opções" não diz nada a quem escolhe. */
  readonly hypothesis: string;
  readonly textOnImage: string;
  readonly path: string;
  readonly pathFromAssets: string;
  readonly hash: string;
  readonly bytes: number;
  readonly providerId: string;
  readonly model: string;
  readonly costUsd: number;
  readonly simulated: boolean;
  readonly reused: boolean;
}

/**
 * Resultado de uma geração de thumbnails.
 *
 * `simulated` e `motivoDoProvedor` viajam juntos de propósito: a tela precisa poder dizer **qual dos dois
 * aconteceu** — arte gerada de verdade (paga) ou prova de máquina local (custo zero). Cair no simulado em
 * silêncio faria o humano achar que tem arte quando tem texto sobre fundo chapado, que é a família de
 * mentira que esta tela inteira existe para corrigir.
 */
export interface ThumbnailRunView {
  readonly channelId: string;
  readonly episodeId: string;
  readonly providerId: string;
  readonly model: string;
  readonly simulated: boolean;
  readonly motivoDoProvedor: string;
  readonly options: readonly ThumbnailOptionView[];
  readonly created: number;
  readonly reused: number;
  readonly manifestPath: string;
  readonly cost: {
    readonly spentNowUsd: number;
    readonly episodeTotalUsd: number;
    readonly perImageUsd: number;
    readonly monthlyUsd: number;
    readonly monthlyLimitUsd: number;
    readonly ledgerPath: string | null;
    readonly ledgerRows: number;
  };
}

/** Gasto de uma etapa, lido do livro de custos. `etapa` é vocabulário de produto — não é provedor. */
export interface StageSpendView {
  readonly etapa: string;
  readonly usd: number;
  readonly linhas: number;
}

/**
 * O gasto **real** de um conteúdo, somado do livro — não a estimativa, não o dado de exemplo.
 *
 * Existe por causa de um número inventado: a tela de Revisão mostrava o `costUsd` do arquivo de exemplo
 * com o rótulo **"Custo real"**. US$ 42,80 para um conteúdo cujo livro soma US$ 0,3956.
 *
 * Três estados, e a diferença entre eles é o ponto:
 *
 * - `ledgerAvailable: true` e `rows > 0` → o valor é o que foi **de fato** lançado;
 * - `ledgerAvailable: true` e `rows === 0` → **nada foi lançado** para este conteúdo. É um zero verdadeiro;
 * - `ledgerAvailable: false` → **não sei** (sem spec de mídia, ou sem livro durável neste ambiente).
 *   Dizer "zero" aqui seria trocar um número inventado por outro.
 */
export interface ContentCostView {
  readonly contentId: string;
  /** Nome de exibição usado no filtro do livro. `null` quando o canal não tem spec de mídia. */
  readonly channelName: string | null;
  readonly ledgerAvailable: boolean;
  readonly totalUsd: number;
  readonly rows: number;
  readonly byStage: readonly StageSpendView[];
  /** Por que não deu para somar, quando `ledgerAvailable` é `false`. */
  readonly motivo?: string;
}
