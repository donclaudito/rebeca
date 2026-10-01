/**
 * Episódio sintético de ponta a ponta — a prova de que o pipeline funciona sem gastar um centavo.
 *
 * A ordem das operações **é** o desenho, e é a mesma que a Fase 1 vai usar:
 *
 *   spec do canal → **portões de gasto (antes de gerar)** → por cena: imagem + voz medida →
 *   plano de quadros → clipes → timeline → trilha → voz alinhada → manifesto → render (longo, Short,
 *   legenda) → custo real por ativo → **portões de gasto (com o custo medido)** → relatório
 *
 * Três decisões que valem explicação:
 *
 * 1. **Os portões vêm antes de gerar.** Trava que só descobre o gasto depois de pagar não é trava. Na Fase
 *    0 o custo estimado é `0` (ffmpeg local não cobra), então os portões passam — mas eles estão no
 *    caminho e são exercitados por teste com custo injetado, para não virarem código morto até o dia em
 *    que passam a importar.
 * 2. **Antes de chamar qualquer provedor, procura-se no manifesto.** Reusar é o comportamento normal de
 *    uma reexecução; gerar de novo só quando o hash mudou. É o que faz a segunda execução não criar
 *    arquivo nem linha de custo.
 * 3. **O custo do episódio sai do livro, não de uma soma em memória.** Assim o número que o portão compara
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
  SceneSpec,
  SpokenLine,
  TtsRequest,
  VideoRequest,
} from '../../src/media/contract.js';
import { assertEpisodeWithinBudget, LONG_RENDER_SPEC, MEDIA_LIMITS } from '../../src/media/limits.js';
import { assertSpecMatchesCode, loadChannelMediaSpec, type ChannelMediaSpec } from './channel-spec.js';
import { assertFfmpegAvailable, probeMedia, type LoudnessMeasurement, type LoudnormAnalysis, type MediaProbe } from './ffmpeg.js';
import { assertMonthlyBudgetForNow, episodeSpendUsd, ledgerPath, ledgerRowCount, recordAssetCost } from './ledger.js';
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
import { estimateSpeechMs, planClip, planImage, planMusic, planVoice, SIMULATED_PROVIDERS } from './providers/simulated.js';
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
  readonly cost: {
    readonly totalUsd: number;
    readonly durationMs: number;
    readonly usdPerMinute: number;
    readonly perMinuteLimitUsd: number;
    readonly monthlyUsd: number;
    readonly monthlyLimitUsd: number;
    readonly approvedBy: string;
    readonly approvedAt: string;
    readonly simulated: true;
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
  const providers = options.providers ?? SIMULATED_PROVIDERS;
  const now = options.now ?? new Date();
  const fps = options.fps ?? LONG_RENDER_SPEC.fps;
  // Na Fase 0 o pipeline roda no canal do próprio episódio. Divergir daqui é o cenário de vazamento que os
  // testes provocam — e que `paths.episodeDir` recusa.
  const scope = spec.channelId;

  assertFfmpegAvailable();

  const channelSpec = loadChannelMediaSpec(spec.channelId);
  if (channelSpec !== null) assertSpecMatchesCode(channelSpec);
  const shortMaxSeconds = channelSpec?.duracao.shortMaxSeg ?? MEDIA_LIMITS.shortMaxSeconds;

  const scenes = sortScenes(spec.scenes);
  const estimatedMs = scenes.reduce((total, scene) => total + estimateSpeechMs(scene.narration), 0);
  const estimateUsd = options.estimateUsd ?? 0;

  // --- PORTÕES DE ENTRADA (antes de gerar qualquer coisa) ---------------------
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
      views.push({
        stage: info.reusedEntry.stage,
        key: info.reusedEntry.key,
        path: resolveStoredPath(info.reusedEntry),
        hash: info.reusedEntry.hash,
        durationMs: info.reusedEntry.durationMs,
        costUsd: info.reusedEntry.costUsd,
        providerId: info.reusedEntry.providerId,
        model: info.reusedEntry.model,
        reused: true,
        simulated: info.reusedEntry.simulated,
      });
      return asset;
    }

    const entry = buildEntry(asset, sha256, {
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
      reused: false,
      simulated: entry.simulated,
    });
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
    const imagePlan = planImage(imageRequest);
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
    cost: {
      totalUsd,
      durationMs: longProbe.durationMs,
      usdPerMinute: rate,
      perMinuteLimitUsd: MEDIA_LIMITS.perMinuteUsd,
      monthlyUsd: budget.spentUsd,
      monthlyLimitUsd: MEDIA_LIMITS.monthlyUsd,
      approvedBy: MEDIA_LIMITS.approvedBy,
      approvedAt: MEDIA_LIMITS.approvedAt,
      simulated: true,
      ledgerPath: ledgerPath(),
      ledgerRows: ledgerRowCount(),
    },
    channelSpec,
  };
}
