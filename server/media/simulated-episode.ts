/**
 * Episódio sintético de ponta a ponta — a prova de que o pipeline funciona sem gastar um centavo.
 *
 * A ordem das operações **é** o desenho, e é a mesma que a Fase 1 vai usar:
 *
 *   spec do canal → **portão de fornecedor (allow-list do canal)** → **portões de gasto (antes de
 *   gerar)** → por cena: imagem + voz medida → plano de quadros → clipes → timeline → trilha → voz
 *   alinhada → manifesto → render (longo, Short, legenda) → custo real por ativo → **portões de gasto
 *   (com o custo medido)** → relatório
 *
 * Quatro decisões que valem explicação:
 *
 * 1. **O portão de fornecedor vem primeiro, e antes do ffmpeg.** Ele é política, não gasto: pergunta se
 *    o provedor pode operar neste canal antes de qualquer outra coisa. Estava faltando neste caminho —
 *    protegia só a rota de thumbnail — e é o que impede um fornecedor vedado no canal infantil de gerar
 *    aqui, que é onde está ~96% do custo do episódio.
 * 2. **Os portões de gasto também vêm antes de gerar.** Trava que só descobre o gasto depois de pagar não
 *    é trava. Na Fase 0 o custo estimado é `0` (ffmpeg local não cobra), então os portões passam — mas
 *    eles estão no caminho e são exercitados por teste com custo injetado, para não virarem código morto
 *    até o dia em que passam a importar.
 * 3. **Antes de chamar qualquer provedor, procura-se no manifesto.** Reusar é o comportamento normal de
 *    uma reexecução; gerar de novo só quando o hash mudou. É o que faz a segunda execução não criar
 *    arquivo nem linha de custo.
 * 4. **O custo do episódio sai do livro, não de uma soma em memória.** Assim o número que o portão compara
 *    com o teto é o mesmo que o negócio vai ler depois — inclusive quando parte dos ativos veio de execução
 *    anterior.
 *
 * Referência visual: **sintética**, e isso fica escrito no manifesto. O Character Sheet da Luna não existe
 * no repositório, então nada aqui prova consistência de personagem (invariante nº 3).
 */

import { statSync } from 'node:fs';
import type {
  GeneratedAsset,
  ImageRequest,
  MediaAsset,
  MediaProviderSet,
  MediaStage,
  MusicRequest,
  ProviderIdentity,
  SceneSpec,
  SpokenLine,
  TtsRequest,
  VideoRequest,
} from '../../src/media/contract.js';
import { assertEpisodeWithinBudget, LONG_RENDER_SPEC, MEDIA_LIMITS, MediaBudgetError } from '../../src/media/limits.js';
import { assertProviderAllowed } from './allow-list.js';
import { assertSpecMatchesCode, loadChannelMediaSpec, type ChannelMediaSpec } from './channel-spec.js';
import { assertFfmpegAvailable, probeMedia, type LoudnessMeasurement, type LoudnormAnalysis, type MediaProbe } from './ffmpeg.js';
import { assertMonthlyBudgetForNow, episodeSpendUsd, ledgerPath, ledgerRowCount, readLedger, recordAssetCost } from './ledger.js';
import {
  emptyManifest,
  findReusable,
  readManifest,
  resolveStoredPath,
  upsertAssets,
  writeManifest,
  type EpisodeManifest,
} from './manifest.js';
import { assetsRelativePath, repoRelativePath } from './paths.js';
import {
  declaredUnitPriceUsd,
  imageProviderNotice,
  planImageFor,
  pngSize,
  resolveImageProvider,
  type ImageProviderNotice,
  type ImageSize,
} from './providers/image-provider.js';
import { estimateSpeechMs, planClip, planMusic, planVoice, SIMULATED_PROVIDERS } from './providers/simulated.js';
import {
  assembleVoiceTrack,
  renderEpisode,
  renderedFileToAsset,
  RENDER_MODEL,
  type RenderedFile,
  type RenderEpisodeResult,
} from './render.js';
import { buildTimeline, planFrames, withMusic, withVoiceTrack, type ResolvedScene } from './timeline.js';

/** Um episódio, do ponto de vista do roteiro/planejamento. Não contém caminho: caminho vem do hash. */
export interface EpisodeSpec {
  readonly channelId: string;
  /** Nome de exibição — é ele que aparece na coluna `canal` do livro de custos. */
  readonly channelName: string;
  readonly episodeId: string;
  readonly slug: string;
  readonly title: string;
  readonly voiceId: string;
  readonly musicMood: string;
  readonly promptVersion: string;
  readonly scenes: readonly SceneSpec[];
}

/**
 * O episódio de exemplo da Fase 0: 3 cenas, ~30 s.
 *
 * O texto é original e curto de propósito (é placeholder de narração, não roteiro aprovado) e não imita
 * material real do canal — a Fase 0 não tem roteiro aprovado nem arte oficial.
 */
export const EPISODIO_SINTETICO: EpisodeSpec = {
  channelId: 'luna',
  channelName: 'Luna e o Jardim das Cores',
  episodeId: 'luna-ep-001',
  slug: 'luna-ep-001',
  title: 'Episódio sintético da Fase 0 (não é conteúdo do canal)',
  voiceId: 'voz-simulada-ptbr',
  musicMood: 'leve e curioso',
  promptVersion: 'criar-cena@v1',
  scenes: [
    {
      id: 'cena-01',
      index: 1,
      narration:
        'Luna acorda com a luz do sol entrando pela janela e percebe que o jardim amanheceu diferente: cada folha tem uma cor que ela nunca tinha visto antes.',
      onScreenText: 'Cena 1 — referência sintética',
      imagePrompt:
        'Referência sintética (o Character Sheet oficial NÃO existe no repositório): personagem pequena e arredondada em um jardim claro, formas suaves, cores da paleta do canal, sem texto na arte.',
      emotion: 'curiosidade',
      seed: 101,
    },
    {
      id: 'cena-02',
      index: 2,
      narration:
        'Ela toca a folha amarela, depois a azul, e descobre que as cores mudam devagar quando a luz atravessa cada uma delas.',
      onScreenText: 'Cena 2 — referência sintética',
      imagePrompt:
        'Referência sintética: a mesma personagem ao lado de duas folhas grandes, uma amarela e uma azul, luz suave atravessando as folhas, composição central.',
      emotion: 'descoberta',
      seed: 202,
    },
    {
      id: 'cena-03',
      index: 3,
      narration:
        'No fim da tarde, Luna entende que o jardim guarda uma cor para cada hora do dia, e sai correndo para contar isso para o Bento.',
      onScreenText: 'Cena 3 — referência sintética',
      imagePrompt:
        'Referência sintética: a personagem correndo em direção ao fundo do jardim no fim da tarde, céu quente, sem texto na arte.',
      emotion: 'alegria',
      seed: 303,
    },
  ],
};

export interface RunEpisodeOptions {
  /** Ponto de troca de provedor — na Fase 1 entra aqui o adapter real, sem mudar mais nada. */
  readonly providers?: MediaProviderSet;
  /**
   * Seleção do provedor de imagem **por configuração** (Fase 2).
   *
   * - `'simulado'` (**padrão**): o ffmpeg local desenha a cena. Custo zero, prova de máquina.
   * - `'auto'`: usa o adapter real quando há chave configurada e cai no simulado quando não há — dizendo
   *   qual dos dois valeu em `EpisodeRunResult.imageProvider`. O portão de allow-list do canal continua
   *   valendo nos dois casos.
   *
   * O padrão é `'simulado'` **de propósito**: selecionar provedor pago por acidente de ambiente faria uma
   * máquina de desenvolvimento com chave começar a gastar dinheiro ao rodar a suíte de testes ou a CLI.
   * Gastar é decisão explícita (invariante nº 4) — `'auto'` é o jeito de pedir isso, e `providers` continua
   * sendo a sobreposição total usada por teste e pela CLI.
   */
  readonly imageProvider?: 'simulado' | 'auto';
  readonly fps?: number;
  /** Injetado nos testes para fixar data do livro e do manifesto. */
  readonly now?: Date;
  /**
   * Custo **estimado** desta execução, para o portão de entrada.
   *
   * Na Fase 0 é `0` (verdade: o ffmpeg local não cobra). Na Fase 1 é a estimativa do provedor pago, e é
   * este número que impede a geração de começar quando o mês já estourou.
   */
  readonly estimateUsd?: number;
}

export interface EpisodeAssetView {
  readonly stage: MediaStage;
  readonly key: string;
  readonly path: string;
  readonly hash: string;
  readonly durationMs: number;
  readonly costUsd: number;
  readonly providerId: string;
  readonly model: string;
  readonly reused: boolean;
  readonly simulated: boolean;
  /**
   * Resolução **medida do arquivo em disco** (cabeçalho PNG), só para ativos de imagem.
   *
   * Existe porque a resolução *pedida* não é a resolução *entregue*: a doc da MiniMax declara que `16:9`
   * devolve 1280x720 nativo, enquanto o render do episódio é 1920x1080. Mostrar o número medido — em vez de
   * repetir o que foi pedido — é o que permite ao humano ver que o vídeo amplia a arte. `null` = não medido.
   */
  readonly imageSize: ImageSize | null;
}

export interface EpisodeRunResult {
  readonly channelId: string;
  readonly channelName: string;
  readonly episodeId: string;
  readonly slug: string;
  readonly title: string;
  readonly sceneCount: number;
  readonly manifestPath: string;
  readonly version: number;
  readonly assets: readonly EpisodeAssetView[];
  readonly renders: {
    readonly long: RenderedFile;
    readonly short: RenderedFile;
    readonly captions: RenderedFile;
  };
  readonly probes: { readonly long: MediaProbe; readonly short: MediaProbe };
  readonly loudness: LoudnessMeasurement | null;
  /** Medição do passe 1 (voz) que alimentou o `loudnorm` linear. `null` = caiu para passe único. */
  readonly voiceLoudness: LoudnormAnalysis | null;
  readonly captionsInfo: {
    readonly blocks: number;
    readonly firstStartMs: number;
    readonly lastEndMs: number;
    readonly videoMs: number;
    readonly maxDriftMs: number;
  };
  readonly created: number;
  readonly reused: number;
  /**
   * Qual arte foi usada nas cenas, com o motivo em pt-BR — a resposta **diz** se é arte de provedor ou
   * prova de máquina. `true` no campo `simulated` sem a frase ao lado não impediu, nas duas vezes em que
   * este projeto errou nisso, que o humano achasse que estava vendo arte do canal.
   */
  readonly imageProvider: ImageProviderNotice;
  readonly cost: {
    readonly totalUsd: number;
    readonly durationMs: number;
    readonly usdPerMinute: number;
    readonly perMinuteLimitUsd: number;
    readonly monthlyUsd: number;
    readonly monthlyLimitUsd: number;
    readonly approvedBy: string;
    readonly approvedAt: string;
    /**
     * A execução inteira saiu de geradores locais sem custo?
     *
     * Era `true` **fixo no tipo** — verdade enquanto só existia a Fase 0, e mentira a partir do momento em
     * que uma cena passa a vir da MiniMax. Agora é calculado: falso se **qualquer** ativo do episódio vier
     * de provedor real.
     */
    readonly simulated: boolean;
    readonly ledgerPath: string | null;
    readonly ledgerRows: number;
  };
  readonly channelSpec: ChannelMediaSpec | null;
}

function sortScenes(scenes: readonly SceneSpec[]): readonly SceneSpec[] {
  return [...scenes].sort((a, b) => a.index - b.index);
}

function elapsedMinutes(startedAt: number): number {
  return Math.max(0, (performance.now() - startedAt) / 60_000);
}

function fileBytes(path: string): number {
  try {
    return statSync(path).size;
  } catch {
    return 0;
  }
}

/** Resolução medida do arquivo, só para ativos de imagem. `null` para áudio/vídeo/texto e para não-PNG. */
function imageSizeOf(kind: MediaAsset['kind'], path: string): ImageSize | null {
  return kind === 'imagem' ? pngSize(path) : null;
}

/**
 * O que o **livro** já registrou para este ativo — `null` quando não há linha. (achado 6 do `QA-015`)
 *
 * Existe para a idempotência **não depender do manifesto**. O arquivo em disco impede pagar de novo, mas
 * era o manifesto que impedia relançar linha no livro: apagado o `meta.json`, a reexecução chamava o
 * provedor (que devolvia `costUsd: 0`) e registrava tudo outra vez, com `reused = 0`. O livro é a memória
 * de gasto do projeto e não pode ser reescrito por um manifesto perdido.
 *
 * O casamento é pelo mesmo `(episódio, etapa, hash8)` que `recordAssetCost` grava — o `hash8` vive dentro
 * de `prompt_id`, no formato `etapa:promptVersion#hash8#duração#simulado|real`. O `episódio` entra na chave
 * de propósito: o mesmo hash em outro episódio é outro ativo, e somar os dois seria inventar custo.
 *
 * ## A chave é `(episódio, etapa, modelo, hash8)` — e o `modelo` não é enfeite
 *
 * O casamento é pelo que `recordAssetCost` grava: `hash8` dentro de `prompt_id`
 * (`etapa:promptVersion#hash8#duração#simulado|real`). O `episódio` entra de propósito (o mesmo hash em
 * outro episódio é outro ativo; somar os dois seria inventar custo).
 *
 * O `modelo` entrou porque a chave de três campos **não é única** — medido, não suposto, ao rodar a suíte
 * depois da primeira versão desta função: `renderEpisode` calcula **um** hash para os três arquivos do
 * render (`longo`, `short` e a legenda saem do mesmo `hash8` de entrada, `render.ts:293`). Com a chave de
 * três campos, a linha gravada para o `longo` fazia o `short` ser lido como "já registrado": o episódio
 * reportava 9 gerados onde havia 10 e o `short` nunca entrava no livro. `RENDER_MODEL.long`/`.short`/
 * `.captions` são distintos, e é isso que separa os três.
 *
 * **Quando não dá para afirmar, devolve `null`** — e aí o pipeline registra de novo. O erro cai para o lado
 * de duplicar uma linha (visível, corrigível) e nunca para o lado de perder gasto (invisível, e é a
 * pergunta central do negócio). Célula de custo ilegível também dá `null`, e não zero: `episodeSpendUsd` já
 * teria lançado sobre essa mesma célula antes de chegar aqui.
 */
function ledgerCostUsd(episodeId: string, stage: MediaStage, model: string, hash8: string): number | null {
  const { header, rows } = readLedger();
  const conteudo = header.indexOf('conteudo');
  const etapa = header.indexOf('etapa');
  const modelo = header.indexOf('modelo');
  const promptId = header.indexOf('prompt_id');
  const custo = header.indexOf('custo_usd');
  if (conteudo === -1 || etapa === -1 || modelo === -1 || promptId === -1 || custo === -1) return null;

  let total: number | null = null;
  for (const row of rows) {
    if ((row[conteudo] ?? '').trim() !== episodeId) continue;
    if ((row[etapa] ?? '').trim() !== stage) continue;
    if ((row[modelo] ?? '').trim() !== model) continue;
    if (!(row[promptId] ?? '').includes(`#${hash8}#`)) continue;
    const valor = Number.parseFloat((row[custo] ?? '').trim());
    if (!Number.isFinite(valor)) return null;
    total = (total ?? 0) + valor;
  }
  return total;
}

/**
 * Escolhe o conjunto de provedores **e** registra de onde veio a escolha.
 *
 * A regra de precedência é explícita porque as duas formas de configurar podem ser passadas juntas:
 * `providers` (sobreposição total, usada por teste e CLI) **vence**; `imageProvider: 'auto'` só vale quando
 * não há conjunto informado. Sem isso, "quem ganha" dependeria da ordem em que o código foi escrito.
 */
function providersForEpisode(options: RunEpisodeOptions): { providers: MediaProviderSet; origem: string } {
  if (options.providers !== undefined) {
    return { providers: options.providers, origem: 'conjunto de provedores informado pelo chamador' };
  }
  if (options.imageProvider === 'auto') {
    const escolha = resolveImageProvider();
    return {
      providers: { ...SIMULATED_PROVIDERS, image: escolha.provider },
      origem: escolha.origem,
    };
  }
  return {
    providers: SIMULATED_PROVIDERS,
    origem:
      'provedores simulados (padrão do pipeline): ffmpeg local, custo zero — prova de máquina. Use ' +
      "imageProvider: 'auto' para a arte real quando houver chave.",
  };
}

/**
 * Estimativa de gasto da execução, somando **só o que os provedores declaram** — ou zero.
 *
 * Zero aqui não é "de graça": é "não dá para estimar", e o portão de entrada reage a isso exigindo uma
 * estimativa explícita. A regra é **tudo ou nada** de propósito: somar as etapas que declaram preço e
 * ignorar as que não declaram produziria um número *menor* que o gasto real, e um teto aplicado sobre um
 * número menor é um teto que libera o que deveria barrar.
 *
 * Contagem por etapa: uma imagem por cena, um clipe por cena, uma fala por cena e **uma** trilha para o
 * episódio. Na Fase 2 só a imagem é paga, e este número é o que permite o episódio rodar com arte real sem
 * que o chamador tenha de inventar a estimativa na mão.
 */
function estimateEpisodeUsd(providers: MediaProviderSet, sceneCount: number): number {
  const etapas: ReadonlyArray<{ provider: ProviderIdentity & { readonly simulated: boolean }; ativos: number }> = [
    { provider: providers.image, ativos: sceneCount },
    { provider: providers.video, ativos: sceneCount },
    { provider: providers.tts, ativos: sceneCount },
    { provider: providers.music, ativos: 1 },
  ];

  let total = 0;
  for (const etapa of etapas) {
    if (etapa.provider.simulated) continue;
    const preco = declaredUnitPriceUsd(etapa.provider);
    // Provedor pago sem preço declarado ⇒ não há estimativa honesta. Zero ⇒ o portão exige a do chamador.
    if (preco === null) return 0;
    total += preco * etapa.ativos;
  }
  return total;
}

/** Reconstrói o `GeneratedAsset` a partir do que já está no manifesto (caminho de reuso). */
function assetFromEntry(entry: MediaAsset): GeneratedAsset {
  return {
    path: resolveStoredPath(entry),
    providerId: entry.providerId,
    model: entry.model,
    costUsd: entry.costUsd,
    hash: entry.hash,
    simulated: entry.simulated,
  };
}

/**
 * Mede o artefato e monta a entrada do manifesto.
 *
 * Imagem não tem duração: o `ffprobe` recusaria (e com razão) um PNG sem duração no formato. Por isso o
 * `kind` decide se há o que medir, em vez de pedir duração a um arquivo que não tem.
 */
function buildEntry(
  asset: GeneratedAsset,
  sha256: string,
  input: {
    readonly channelId: string;
    readonly episodeId: string;
    readonly stage: MediaStage;
    readonly key: string;
    readonly kind: MediaAsset['kind'];
    readonly promptVersion: string;
    readonly now: Date;
  },
): MediaAsset {
  return {
    channelId: input.channelId,
    episodeId: input.episodeId,
    stage: input.stage,
    kind: input.kind,
    key: input.key,
    version: 1,
    path: repoRelativePath(asset.path),
    pathFromAssets: assetsRelativePath(asset.path),
    hash: asset.hash,
    sha256,
    durationMs: input.kind === 'imagem' ? 0 : probeMedia(asset.path).durationMs,
    bytes: fileBytes(asset.path),
    providerId: asset.providerId,
    model: asset.model,
    promptVersion: input.promptVersion,
    costUsd: asset.costUsd,
    simulated: asset.simulated,
    // Fase 0: não existe Character Sheet. Marcado, não presumido.
    reference: 'sintetica',
    approved: false,
    recordedAt: input.now.toISOString(),
  };
}

/**
 * Roda o episódio inteiro.
 *
 * Devolve tudo que é preciso para auditar a execução sem abrir arquivo: caminhos, medidas do `ffprobe`,
 * loudness medido, custo total, custo por minuto e o estado do livro.
 */
export async function runSimulatedEpisode(
  spec: EpisodeSpec = EPISODIO_SINTETICO,
  options: RunEpisodeOptions = {},
): Promise<EpisodeRunResult> {
  const now = options.now ?? new Date();
  const fps = options.fps ?? LONG_RENDER_SPEC.fps;
  // Na Fase 0 o pipeline roda no canal do próprio episódio. Divergir daqui é o cenário de vazamento que os
  // testes provocam — e que `paths.episodeDir` recusa.
  const scope = spec.channelId;

  // A troca de provedor acontece **aqui**, por configuração, e em nenhum outro ponto do pipeline: daqui
  // para baixo nada pergunta qual é o fornecedor (invariante nº 7). `origem` entra no relatório.
  const escolha = providersForEpisode(options);
  const providers = escolha.providers;
  const imageProvider = imageProviderNotice(providers.image);

  // --- PORTÃO DE FORNECEDOR (antes de tudo, inclusive do ffmpeg) --------------
  /*
   * Fecha o furo que o estado registrava em 2026-10-01: o portão da allow-list existia desde o gerador
   * de thumbnail e protegia **só** aquela rota. O caminho de vídeo — que é ~96% do custo de um episódio
   * — atravessava sem consulta nenhuma, e um fornecedor `PROIBIDO` ou `NAO-VERIFICADO` geraria
   * normalmente, com dinheiro real. Era a política valendo para a etapa barata e não valendo para a cara.
   *
   * Ele vem **antes** do portão de custo, e a ordem é decisão, não acaso: o `ADR-005` diz literalmente
   * que a allow-list existe para "impedir o preço de justificar o fornecedor". Invertida a ordem, um
   * provedor barato seria comparado com o teto antes de alguém perguntar se ele pode operar neste canal.
   *
   * Roda **mesmo quando tudo seria reusado**. A checagem é de política, não de gasto, e um portão que
   * se desliga quando o cache acerta é um portão que se desliga justamente na reexecução — que é o
   * caminho mais comum do pipeline.
   *
   * A `finalidade` é o nome da **etapa** (`imagem`, `animacao`, `voz`, `musica`), porque é assim que a
   * allow-list do canal está escrita hoje. Divergência conhecida e declarada: a entrada de vídeo real
   * (`minimax` / `MiniMax-H3-768P`) está gravada com a finalidade `video`, não `animacao` — logo, trocar
   * o provedor de vídeo hoje é **recusado** até essa reconciliação, que é decisão humana sobre arquivo
   * aprovado por humano. Recusar é o default conservador do `ADR-005`; passar por cima seria o furo.
   */
  for (const alvo of [
    { etapa: 'imagem', provider: providers.image },
    { etapa: 'animacao', provider: providers.video },
    { etapa: 'voz', provider: providers.tts },
    { etapa: 'musica', provider: providers.music },
  ] as const) {
    assertProviderAllowed({
      channelId: spec.channelId,
      provider: alvo.provider.id,
      model: alvo.provider.model,
      purpose: alvo.etapa,
    });
  }

  assertFfmpegAvailable();

  const channelSpec = loadChannelMediaSpec(spec.channelId);
  if (channelSpec !== null) assertSpecMatchesCode(channelSpec);
  const shortMaxSeconds = channelSpec?.duracao.shortMaxSeg ?? MEDIA_LIMITS.shortMaxSeconds;

  const scenes = sortScenes(spec.scenes);
  const estimatedMs = scenes.reduce((total, scene) => total + estimateSpeechMs(scene.narration), 0);
  /*
   * A estimativa vem do chamador quando ele informa, e do **preço declarado pelos provedores** quando não.
   *
   * A estimativa automática é o que permite a arte real rodar sem alguém digitar um número na mão — e ela
   * desaparece (volta a `0`) se qualquer provedor pago não declarar preço, o que mantém o portão abaixo
   * exigindo estimativa explícita nesse caso. Zero nunca é "de graça": é "não sei".
   */
  const estimateUsd = options.estimateUsd ?? estimateEpisodeUsd(providers, scenes.length);

  // --- PORTÕES DE ENTRADA (antes de gerar qualquer coisa) ---------------------
  /*
   * Com provedor **pago** no conjunto, a estimativa é obrigatória.
   *
   * Antes isto era `options.estimateUsd ?? 0`: um chamador sem estimativa fazia o portão comparar zero
   * com o teto — passava — e o pipeline gerava tudo antes de o portão de saída (já com custo medido)
   * disparar. O `rebeca-qa` reproduziu com provedor de US$ 50 por ativo: **21 arquivos e 7 linhas de
   * custo (US$ 200) lançados antes de qualquer bloqueio**. Portão que só funciona depois de gastar não
   * é portão. Os provedores simulados seguem com estimativa zero, que é a verdade deles.
   *
   * Na Fase 2 a estimativa passa a ser calculada a partir do preço **declarado** pelo provedor pago (a
   * imagem da MiniMax declara US$ 0,0035). O que continua exigindo estimativa explícita é o caso em que o
   * preço **não** é declarado: aí a soma volta a zero e este portão dispara, em vez de liberar a geração
   * sobre um número que ninguém conhece.
   */
  const provedoresPagos = [providers.image, providers.video, providers.tts, providers.music].filter(
    (provider) => !provider.simulated,
  );
  if (provedoresPagos.length > 0 && estimateUsd <= 0) {
    throw new MediaBudgetError(
      'estimativa-obrigatoria',
      `Há provedor pago no pipeline (${provedoresPagos.map((provider) => provider.id).join(', ')}) e nenhuma ` +
        'estimativa de custo pôde ser calculada — nenhuma foi informada, ou algum provedor pago não declara ' +
        'preço por ativo (o que é "não verificado", não "de graça"). Sem estimativa o teto não tem o que ' +
        'comparar ANTES de gerar: informe estimateUsd ou rode com os provedores simulados.',
    );
  }

  assertEpisodeWithinBudget({ costUsd: estimateUsd, durationMs: estimatedMs, source: 'estimado' });
  assertMonthlyBudgetForNow(now, estimateUsd);

  let manifest: EpisodeManifest =
    readManifest(scope, spec.channelId, spec.episodeId) ?? emptyManifest(spec.channelId, spec.episodeId, spec.slug, now);

  const entries: MediaAsset[] = [];
  const views: EpisodeAssetView[] = [];
  let created = 0;
  let reused = 0;

  const register = (
    asset: GeneratedAsset,
    sha256: string,
    info: { stage: MediaStage; key: string; kind: MediaAsset['kind']; tempoMin: number; reusedEntry?: MediaAsset },
  ): GeneratedAsset => {
    if (info.reusedEntry !== undefined) {
      reused += 1;
      entries.push(info.reusedEntry);
      const reusedPath = resolveStoredPath(info.reusedEntry);
      views.push({
        stage: info.reusedEntry.stage,
        key: info.reusedEntry.key,
        path: reusedPath,
        hash: info.reusedEntry.hash,
        durationMs: info.reusedEntry.durationMs,
        costUsd: info.reusedEntry.costUsd,
        providerId: info.reusedEntry.providerId,
        model: info.reusedEntry.model,
        reused: true,
        simulated: info.reusedEntry.simulated,
        // Medido do disco mesmo no reuso: o manifesto guarda bytes, não pixels, e a resolução real do
        // arquivo é justamente o que não pode ser presumido a partir do pedido.
        imageSize: imageSizeOf(info.reusedEntry.kind, reusedPath),
      });
      return asset;
    }

    /*
     * ---------------------------------------------------------------- achado 6 do `QA-015`
     *                                                     + achado NOVO do `QA-016` (ALTA, dinheiro)
     *
     * O caminho acima (`reusedEntry`) só existe quando o **manifesto** conhece o ativo. Perdido o
     * `meta.json` — e com os arquivos no disco — o pipeline chamava o provedor de novo; o provedor não
     * gastava nada (o arquivo estava lá), mas o livro ganhava linha nova e o relatório dizia "gerado de
     * novo" onde não houve geração nem gasto.
     *
     * A primeira correção consultava o livro e, achando linha, **nunca** registrava de novo. Isso estava
     * errado num caso que o `QA-016` reproduziu: com o **arquivo apagado** e o livro intacto, o provedor é
     * chamado outra vez e **cobra outra vez** — e o livro, achando a linha antiga, omitia a segunda
     * cobrança. O episódio seguia relatando o custo de UMA imagem depois de ter pago duas.
     *
     * A regra agora separa as duas situações pelo único fato que importa para o livro:
     *
     * - **O provedor cobrou agora (`costUsd > 0`)?** Houve geração paga de verdade: o livro **registra**,
     *   sempre, e o ativo conta como gerado. É o invariante nº 4 — nenhuma consulta ao livro pode
     *   dispensá-lo.
     * - **O provedor não cobrou (`costUsd === 0`)?** O arquivo já existia: se o livro tem linha para este
     *   `(episódio, etapa, modelo, hash8)`, o ativo **já foi pago antes** — não gera linha nova, conta
     *   como reuso, e a entrada reconstruída do manifesto recebe o custo que o LIVRO registra (não o `0`
     *   que o provedor devolveu, senão o manifesto diria que a arte foi de graça).
     *
     * O contrato da primeira versão continua valendo e é ele que decide o empate: o erro cai para o lado
     * de duplicar uma linha (visível, corrigível) e nunca para o lado de perder gasto (invisível).
     */
    const gastouAgora = asset.costUsd > 0;
    const jaNoLivro = gastouAgora ? null : ledgerCostUsd(spec.episodeId, info.stage, asset.model, asset.hash);
    const entry = buildEntry(jaNoLivro === null ? asset : { ...asset, costUsd: jaNoLivro }, sha256, {
      channelId: spec.channelId,
      episodeId: spec.episodeId,
      stage: info.stage,
      key: info.key,
      kind: info.kind,
      promptVersion: spec.promptVersion,
      now,
    });
    entries.push(entry);

    views.push({
      stage: entry.stage,
      key: entry.key,
      path: asset.path,
      hash: entry.hash,
      durationMs: entry.durationMs,
      costUsd: entry.costUsd,
      providerId: entry.providerId,
      model: entry.model,
      reused: jaNoLivro !== null,
      simulated: entry.simulated,
      imageSize: imageSizeOf(entry.kind, asset.path),
    });

    if (jaNoLivro !== null) {
      reused += 1;
      return { ...asset, costUsd: jaNoLivro };
    }
    created += 1;

    // O custo entra no livro **aqui**, onde se sabe que houve geração. Ativo reusado não gera linha:
    // registrar de novo transformaria a prova de idempotência em ficção.
    recordAssetCost({
      channelId: spec.channelId,
      channelName: spec.channelName,
      episodeId: spec.episodeId,
      stage: info.stage,
      providerId: asset.providerId,
      model: asset.model,
      promptVersion: spec.promptVersion,
      hash8: asset.hash,
      durationMs: entry.durationMs,
      costUsd: asset.costUsd,
      simulated: asset.simulated,
      tempoMin: info.tempoMin,
      now,
    });

    return asset;
  };

  const base = {
    channelId: spec.channelId,
    scopeChannelId: scope,
    episodeId: spec.episodeId,
    promptVersion: spec.promptVersion,
  };

  // --- POR CENA: imagem e voz medida -----------------------------------------
  const imageByScene = new Map<string, GeneratedAsset>();
  const clipByScene = new Map<string, GeneratedAsset>();
  const spokenByScene = new Map<string, SpokenLine>();

  for (const scene of scenes) {
    const imageRequest: ImageRequest = {
      ...base,
      sceneId: scene.id,
      prompt: scene.imagePrompt,
      onScreenText: scene.onScreenText,
      width: LONG_RENDER_SPEC.width,
      height: LONG_RENDER_SPEC.height,
      seed: scene.seed,
    };
    /*
     * O plano vem **do provedor que vai gerar** — não de `planImage` (o do ffmpeg).
     *
     * Antes da Fase 2 esta linha era `planImage(imageRequest)`. Enquanto só existia um provedor de imagem,
     * funcionava; no dia em que entrasse a MiniMax, o hash e o nome do arquivo continuariam sendo os do
     * simulado, e a arte real nasceria com nome de prova de máquina — a reexecução então reusaria o PNG do
     * ffmpeg achando que era a imagem paga. `planImageFor` pergunta ao provedor: o real traz o próprio
     * `plan`, o simulado usa o dele. Nenhum `if` de fornecedor aqui.
     */
    const imagePlan = planImageFor(providers.image, imageRequest);
    const imageEntry = findReusable(manifest, 'imagem', scene.id, imagePlan.hash);
    if (imageEntry !== undefined) {
      imageByScene.set(
        scene.id,
        register(assetFromEntry(imageEntry), imageEntry.sha256, {
          stage: 'imagem',
          key: scene.id,
          kind: 'imagem',
          tempoMin: 0,
          reusedEntry: imageEntry,
        }),
      );
    } else {
      const startedAt = performance.now();
      const image = await providers.image.render(imageRequest);
      imageByScene.set(
        scene.id,
        register(image, imagePlan.sha256, { stage: 'imagem', key: scene.id, kind: 'imagem', tempoMin: elapsedMinutes(startedAt) }),
      );
    }

    const ttsRequest: TtsRequest = {
      ...base,
      sceneId: scene.id,
      text: scene.narration,
      voiceId: spec.voiceId,
      lang: 'pt-BR',
    };
    const voicePlan = planVoice(ttsRequest);
    const voiceEntry = findReusable(manifest, 'voz', scene.id, voicePlan.hash);
    if (voiceEntry !== undefined) {
      const asset = assetFromEntry(voiceEntry);
      spokenByScene.set(scene.id, { ...asset, durationMs: voiceEntry.durationMs });
      register(asset, voiceEntry.sha256, { stage: 'voz', key: scene.id, kind: 'audio', tempoMin: 0, reusedEntry: voiceEntry });
    } else {
      const startedAt = performance.now();
      const spoken = await providers.tts.synthesize(ttsRequest);
      spokenByScene.set(scene.id, spoken);
      register(spoken, voicePlan.sha256, { stage: 'voz', key: scene.id, kind: 'audio', tempoMin: elapsedMinutes(startedAt) });
    }
  }

  // --- PLANO DE QUADROS (a voz medida manda) ---------------------------------
  const spokenDurations = scenes.map((scene) => {
    const spoken = spokenByScene.get(scene.id);
    if (spoken === undefined) throw new Error(`Sem fala medida para "${scene.id}".`);
    return spoken.durationMs;
  });
  const framePlan = planFrames(spokenDurations, fps, scenes.map((scene) => scene.id));

  for (const [position, scene] of scenes.entries()) {
    const span = framePlan.spans[position];
    const image = imageByScene.get(scene.id);
    if (span === undefined || image === undefined) throw new Error(`Plano de quadros incompleto para "${scene.id}".`);

    const clipRequest: VideoRequest = {
      ...base,
      sceneId: scene.id,
      imagePath: image.path,
      imageHash: image.hash,
      durationMs: span.durationMs,
      frames: span.durationFrames,
      width: LONG_RENDER_SPEC.width,
      height: LONG_RENDER_SPEC.height,
      fps,
      motion: 'zoom-in-lento',
    };
    const clipPlan = planClip(clipRequest);
    const clipEntry = findReusable(manifest, 'animacao', scene.id, clipPlan.hash);
    if (clipEntry !== undefined) {
      clipByScene.set(
        scene.id,
        register(assetFromEntry(clipEntry), clipEntry.sha256, {
          stage: 'animacao',
          key: scene.id,
          kind: 'video',
          tempoMin: 0,
          reusedEntry: clipEntry,
        }),
      );
    } else {
      const startedAt = performance.now();
      const clip = await providers.video.animate(clipRequest);
      clipByScene.set(
        scene.id,
        register(clip, clipPlan.sha256, { stage: 'animacao', key: scene.id, kind: 'video', tempoMin: elapsedMinutes(startedAt) }),
      );
    }
  }

  // --- TIMELINE --------------------------------------------------------------
  const resolved: ResolvedScene[] = scenes.map((scene) => {
    const spoken = spokenByScene.get(scene.id);
    const image = imageByScene.get(scene.id);
    const clip = clipByScene.get(scene.id);
    if (spoken === undefined || image === undefined || clip === undefined) {
      throw new Error(`Cena "${scene.id}" sem artefato completo — o pipeline não continua com buraco.`);
    }
    return { spec: scene, spoken, image, clip };
  });
  let timeline = buildTimeline({
    channelId: spec.channelId,
    episodeId: spec.episodeId,
    slug: spec.slug,
    fps,
    scenes: resolved,
  });

  // --- TRILHA (duração = duração do episódio) --------------------------------
  const musicRequest: MusicRequest = {
    ...base,
    mood: spec.musicMood,
    durationMs: timeline.totalMs,
  };
  const musicPlan = planMusic(musicRequest);
  const musicEntry = findReusable(manifest, 'musica', 'trilha', musicPlan.hash);
  let musicAsset: GeneratedAsset;
  let musicDurationMs: number;
  if (musicEntry !== undefined) {
    musicAsset = assetFromEntry(musicEntry);
    musicDurationMs = musicEntry.durationMs;
    register(musicAsset, musicEntry.sha256, { stage: 'musica', key: 'trilha', kind: 'audio', tempoMin: 0, reusedEntry: musicEntry });
  } else {
    const startedAt = performance.now();
    musicAsset = await providers.music.compose(musicRequest);
    musicDurationMs = probeMedia(musicAsset.path).durationMs;
    register(musicAsset, musicPlan.sha256, { stage: 'musica', key: 'trilha', kind: 'audio', tempoMin: elapsedMinutes(startedAt) });
  }

  // --- MANIFESTO DOS ATIVOS PAGOS, ANTES DO RESTO ----------------------------
  // Este é o ponto em que **toda** geração (imagem, voz, clipe, trilha) já aconteceu. Gravar aqui, e não
  // no fim, é o que impede custo pago de virar custo fantasma: se o render falhar em seguida, o que já
  // foi gerado está registrado, e a próxima execução reusa em vez de pagar de novo.
  manifest = upsertAssets(manifest, entries, now);
  const manifestPath = writeManifest(manifest, scope);

  timeline = withMusic(timeline, { asset: musicAsset, durationMs: musicDurationMs, gain: LONG_RENDER_SPEC.musicGain });

  // --- VOZ ALINHADA ----------------------------------------------------------
  timeline = withVoiceTrack(timeline, assembleVoiceTrack(timeline, scope));

  // --- RENDER -----------------------------------------------------------------
  const renderStartedAt = performance.now();
  const render: RenderEpisodeResult = renderEpisode({ timeline, scopeChannelId: scope, shortMaxSeconds });
  const renderTempoMin = elapsedMinutes(renderStartedAt);

  if (!render.reused) {
    const renderEntries: MediaAsset[] = [
      renderedFileToAsset(render.long, {
        channelId: spec.channelId,
        episodeId: spec.episodeId,
        stage: 'render',
        key: 'longo',
        version: render.version,
        costUsd: 0,
        simulated: true,
        promptVersion: 'render-v1',
        providerId: 'ffmpeg',
        model: RENDER_MODEL.long,
        now,
      }),
      renderedFileToAsset(render.short, {
        channelId: spec.channelId,
        episodeId: spec.episodeId,
        stage: 'render',
        key: 'short',
        version: render.version,
        costUsd: 0,
        simulated: true,
        promptVersion: 'render-v1',
        providerId: 'ffmpeg',
        model: RENDER_MODEL.short,
        now,
      }),
      renderedFileToAsset(render.captions, {
        channelId: spec.channelId,
        episodeId: spec.episodeId,
        stage: 'legenda',
        key: 'legenda',
        version: render.version,
        costUsd: 0,
        simulated: true,
        promptVersion: 'render-v1',
        providerId: 'ffmpeg',
        model: RENDER_MODEL.captions,
        now,
      }),
    ];

    for (const entry of renderEntries) {
      /*
       * Mesma razão do `register` (achado 6 do `QA-015`): com o manifesto perdido, o render é refeito e
       * este laço relançaria as três linhas de `render`/`legenda` no livro. O render não tem custo de
       * provedor, mas "linha nova no livro a cada reexecução sem manifesto" é a mesma mentira de
       * idempotência — e é ela que faz o operador ler "isto foi gerado de novo" onde nada foi produzido.
       */
      const jaNoLivro =
        entry.costUsd > 0 ? null : ledgerCostUsd(spec.episodeId, entry.stage, entry.model, entry.hash);
      if (jaNoLivro !== null) {
        reused += 1;
        views.push({
          stage: entry.stage,
          key: entry.key,
          path: resolveStoredPath(entry),
          hash: entry.hash,
          durationMs: entry.durationMs,
          costUsd: jaNoLivro,
          providerId: entry.providerId,
          model: entry.model,
          reused: true,
          simulated: entry.simulated,
          imageSize: null,
        });
        continue;
      }

      views.push({
        stage: entry.stage,
        key: entry.key,
        path: resolveStoredPath(entry),
        hash: entry.hash,
        durationMs: entry.durationMs,
        costUsd: entry.costUsd,
        providerId: entry.providerId,
        model: entry.model,
        reused: false,
        simulated: entry.simulated,
        // Render e legenda não são imagem: nada a medir em pixel.
        imageSize: null,
      });
      created += 1;
      recordAssetCost({
        channelId: spec.channelId,
        channelName: spec.channelName,
        episodeId: spec.episodeId,
        stage: entry.stage,
        providerId: entry.providerId,
        model: entry.model,
        promptVersion: entry.promptVersion,
        hash8: entry.hash,
        durationMs: entry.durationMs,
        costUsd: entry.costUsd,
        simulated: entry.simulated,
        // O tempo de geração é o do comando de render inteiro; dividir por três seria inventar número.
        tempoMin: renderTempoMin,
        now,
      });
    }

    const fresh = readManifest(scope, spec.channelId, spec.episodeId) ?? manifest;
    writeManifest(upsertAssets(fresh, renderEntries, now), scope);
  } else {
    // Render reusado: entra no relatório como reusado. Sem isto a segunda execução diria "0 gerados"
    // mas "7 reusados", e o número não fecharia com o total de ativos do episódio.
    const atual = readManifest(scope, spec.channelId, spec.episodeId);
    for (const alvo of [
      { stage: 'render' as const, key: 'longo' },
      { stage: 'render' as const, key: 'short' },
      { stage: 'legenda' as const, key: 'legenda' },
    ]) {
      const entry = atual?.assets.find(
        (asset) => asset.stage === alvo.stage && asset.key === alvo.key && asset.version === render.version,
      );
      if (entry === undefined) continue;
      views.push({
        stage: entry.stage,
        key: entry.key,
        path: resolveStoredPath(entry),
        hash: entry.hash,
        durationMs: entry.durationMs,
        costUsd: entry.costUsd,
        providerId: entry.providerId,
        model: entry.model,
        reused: true,
        simulated: entry.simulated,
        imageSize: null,
      });
      reused += 1;
    }
  }

  // --- PORTÕES DE SAÍDA (com o custo e a duração MEDIDOS) ---------------------
  const longProbe = probeMedia(render.long.path);
  const shortProbe = probeMedia(render.short.path);
  const totalUsd = episodeSpendUsd(spec.episodeId, spec.channelName);
  const rate = assertEpisodeWithinBudget({ costUsd: totalUsd, durationMs: longProbe.durationMs, source: 'medido' });
  const budget = assertMonthlyBudgetForNow(now, 0);

  return {
    channelId: spec.channelId,
    channelName: spec.channelName,
    episodeId: spec.episodeId,
    slug: spec.slug,
    title: spec.title,
    sceneCount: scenes.length,
    manifestPath,
    version: render.version,
    assets: views,
    renders: { long: render.long, short: render.short, captions: render.captions },
    probes: { long: longProbe, short: shortProbe },
    loudness: render.loudness,
    voiceLoudness: render.voiceLoudness,
    captionsInfo: {
      blocks: timeline.scenes.length,
      firstStartMs: timeline.scenes[0]?.startMs ?? 0,
      lastEndMs: timeline.scenes[timeline.scenes.length - 1]?.endMs ?? 0,
      videoMs: timeline.totalMs,
      maxDriftMs: timeline.maxDriftMs,
    },
    created,
    reused,
    imageProvider,
    cost: {
      totalUsd,
      durationMs: longProbe.durationMs,
      usdPerMinute: rate,
      perMinuteLimitUsd: MEDIA_LIMITS.perMinuteUsd,
      monthlyUsd: budget.spentUsd,
      monthlyLimitUsd: MEDIA_LIMITS.monthlyUsd,
      approvedBy: MEDIA_LIMITS.approvedBy,
      approvedAt: MEDIA_LIMITS.approvedAt,
      // Calculado, não fixo: `false` no instante em que qualquer ativo do episódio vier de provedor real.
      simulated: views.every((view) => view.simulated),
      ledgerPath: ledgerPath(),
      ledgerRows: ledgerRowCount(),
    },
    channelSpec,
  };
}
