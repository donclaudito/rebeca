/**
 * Montagem e render — onde a timeline vira arquivo.
 *
 * O que este arquivo garante, e por quê:
 *
 * 1. **A voz é alinhada à grade de quadros, cena por cena.** Cada fala medida é esticada com `apad` até a
 *    duração quantizada daquela cena. É isso que faz o início da fala coincidir com o início do bloco de
 *    legenda — sem o `apad`, a diferença de arredondamento viraria legenda fora de sincronia.
 * 2. **O longo é um comando só, com `loudnorm` na narração e trilha a 25%.** Normalizar depois, em passe
 *    separado, exigiria reencodar o vídeo inteiro — perda de qualidade de graça.
 * 3. **O Short é recorte do MESMO material** (`crop=ih*9/16:ih,scale=1080:1920`), não um segundo render.
 *    Assim ele não pode divergir do vídeo aprovado, e não se paga duas vezes pela mesma cena.
 * 4. **`-frames:v` no Short, não `-t`.** Contagem de quadros é exata; duração em segundos flutua.
 * 5. **Versão nova em vez de sobrescrita.** O caminho do render carrega `v<N>`; conteúdo diferente ⇒
 *    versão nova, decidida pelo hash. `final_v2_final.mp4` é o anti-padrão que isso elimina.
 */

import { existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import type { EpisodeTimeline, MediaAsset, RenderSpec } from '../../src/media/contract.js';
import { LONG_RENDER_SPEC, MEDIA_LIMITS, SHORT_RENDER_SPEC } from '../../src/media/limits.js';
import { assetFingerprint, assetHash } from './hash.js';
import { findReusable, nextVersion, readManifest } from './manifest.js';
import { assetsRelativePath, ensureParentDir, renderDir, renderPath, repoRelativePath, workPath } from './paths.js';
import { analyzeLoudness, measureLoudness, probeMedia, runFfmpegOrThrow, type LoudnessMeasurement, type LoudnormAnalysis } from './ffmpeg.js';
import { assertReadyToRender, assertSrtWithinVideo, renderSrt, srtBlocks } from './timeline.js';

/** Nome do arquivo de render — o formato que a skill `rebeca-ia-video` especifica. */
export function renderFileName(slug: string, profile: RenderSpec['profile'], version: number, ext: 'mp4' | 'srt'): string {
  const tag = profile === 'longo-16x9' ? '16x9' : '9x16';
  return `${slug}-${tag}-v${version}.${ext}`;
}

/**
 * "Modelos" do render — o equivalente a `providerId`/`model` das etapas de IA.
 *
 * Entram no hash e no manifesto, então mudar o pipeline de render (por exemplo, sair do loudnorm de passe
 * único para o linear) muda o hash e força versão nova, em vez de reusar em silêncio um arquivo gerado por
 * outra regra. Fonte única: o pipeline importa daqui em vez de repetir a string.
 */
export const RENDER_MODEL = {
  long: `libx264-crf${LONG_RENDER_SPEC.crf}-loudnorm2pass`,
  short: 'crop-vertical-1',
  captions: 'srt-1',
} as const;

export interface RenderedFile {
  readonly profile: 'longo-16x9' | 'short-9x16' | 'legenda';
  readonly path: string;
  readonly pathFromAssets: string;
  readonly width: number | null;
  readonly height: number | null;
  readonly fps: number | null;
  readonly frames: number | null;
  readonly durationMs: number;
  readonly bytes: number;
  readonly sha256: string;
  readonly hash8: string;
}

export interface RenderEpisodeInput {
  readonly timeline: EpisodeTimeline;
  /** Canal em que o pipeline roda — portão de isolamento. */
  readonly scopeChannelId: string;
  readonly longSpec?: RenderSpec;
  readonly shortSpec?: RenderSpec;
  readonly shortMaxSeconds?: number;
}

export interface RenderEpisodeResult {
  readonly version: number;
  /** `true` quando nada foi renderizado nesta execução (hash bateu e os arquivos existem). */
  readonly reused: boolean;
  readonly long: RenderedFile;
  readonly short: RenderedFile;
  readonly captions: RenderedFile;
  readonly loudness: LoudnessMeasurement | null;
  /**
   * Medição do passe 1 (a faixa de voz, antes da mixagem).
   *
   * `null` significa que o resumo do ffmpeg não veio no formato esperado e o render caiu para passe único
   * — o relatório precisa saber disso, porque "aplicamos loudnorm" e "o áudio está no alvo" são
   * afirmações diferentes.
   */
  readonly voiceLoudness: LoudnormAnalysis | null;
  /** Hash de entrada do render — vai ao manifesto e é o que sustenta a idempotência. */
  readonly hash: string;
  readonly sha256: string;
}

/**
 * Escapa um caminho para a lista do demuxer `concat`.
 *
 * O demuxer interpreta `\` como escape e usa `'` como delimitador: caminho do Windows entra com barra
 * normal, e aspas simples no caminho são recusadas — não há forma portável de escapar isso, e um caminho
 * com aspas significa que alguém apontou a raiz de ativos para um lugar estranho.
 */
function concatEntry(file: string): string {
  const normalized = file.replaceAll('\\', '/');
  if (normalized.includes("'")) {
    throw new Error(`Caminho com aspas simples não pode entrar na lista do concat: "${normalized}"`);
  }
  return `file '${normalized}'`;
}

/**
 * Faixa de voz alinhada à timeline.
 *
 * Para cada cena: a fala medida, esticada com `apad` até a duração **quantizada** daquela cena. O
 * resultado tem exatamente a duração do vídeo, e cada fala começa no quadro em que a cena começa.
 */
export function assembleVoiceTrack(timeline: EpisodeTimeline, scopeChannelId: string): string {
  const aligned: string[] = [];
  const scope = { scopeChannelId, channelId: timeline.channelId, episodeId: timeline.episodeId };

  for (const scene of timeline.scenes) {
    const seconds = (scene.durationFrames * (1000 / timeline.fps)) / 1000;
    const hash8 = assetHash({
      stage: 'voz-alinhada',
      promptVersion: 'v1',
      providerId: 'ffmpeg',
      model: 'apad-1',
      input: { spokenHash: scene.spoken.hash, sceneId: scene.spec.id },
      params: { frames: scene.durationFrames, fps: timeline.fps },
    });
    const target = workPath(scope.scopeChannelId, scope.channelId, scope.episodeId, `voz-alinhada-${scene.spec.id}-${hash8}.wav`);

    if (!existsSync(target)) {
      ensureParentDir(target);
      runFfmpegOrThrow([
        '-y',
        '-hide_banner',
        '-loglevel',
        'error',
        '-i',
        scene.spoken.path,
        '-af',
        `apad=whole_dur=${seconds.toFixed(6)}`,
        '-t',
        seconds.toFixed(6),
        '-c:a',
        'pcm_s16le',
        '-ar',
        String(LONG_RENDER_SPEC.audioSampleRate),
        '-ac',
        '1',
        target,
      ]);
    }

    const measured = probeMedia(target);
    if (Math.abs(measured.durationMs - scene.durationMs) > 1000 / timeline.fps) {
      throw new Error(
        `A voz alinhada de "${scene.spec.id}" tem ${measured.durationMs} ms, mas a cena tem ${scene.durationMs} ms. ` +
          'Se a voz não bate com a cena, a legenda sai fora de sincronia — o render foi abortado.',
      );
    }
    aligned.push(target);
  }

  const hash8 = assetHash({
    stage: 'voz-episodio',
    promptVersion: 'v1',
    providerId: 'ffmpeg',
    model: 'concat-1',
    input: timeline.scenes.map((scene) => ({ id: scene.spec.id, hash: scene.spoken.hash, frames: scene.durationFrames })),
    params: { fps: timeline.fps, totalFrames: timeline.totalFrames },
  });
  const track = workPath(scope.scopeChannelId, scope.channelId, scope.episodeId, `voz-episodio-${hash8}.wav`);

  if (!existsSync(track)) {
    const listFile = workPath(scope.scopeChannelId, scope.channelId, scope.episodeId, 'vozes.txt');
    ensureParentDir(listFile);
    writeFileSync(listFile, `${aligned.map(concatEntry).join('\n')}\n`, 'utf8');
    runFfmpegOrThrow([
      '-y',
      '-hide_banner',
      '-loglevel',
      'error',
      '-f',
      'concat',
      '-safe',
      '0',
      '-i',
      listFile,
      '-c:a',
      'pcm_s16le',
      '-ar',
      String(LONG_RENDER_SPEC.audioSampleRate),
      '-ac',
      '1',
      track,
    ]);
  }

  const measured = probeMedia(track);
  if (Math.abs(measured.durationMs - timeline.totalMs) > 1000 / timeline.fps) {
    throw new Error(
      `A faixa de voz tem ${measured.durationMs} ms e a timeline tem ${timeline.totalMs} ms (tolerância de um quadro). ` +
        'Áudio e vídeo discordando é bug de sincronia, não detalhe estético.',
    );
  }
  return track;
}

/** Hash de entrada do render: cenas + durações + parâmetros de saída. Nunca caminho absoluto. */
export function renderInputHash(
  timeline: EpisodeTimeline,
  longSpec: RenderSpec,
  shortSpec: RenderSpec,
  shortFrames: number,
): string {
  return assetHash({
    stage: 'render',
    promptVersion: 'render-v1',
    providerId: 'ffmpeg',
    model: RENDER_MODEL.long,
    input: timeline.scenes.map((scene) => ({
      id: scene.spec.id,
      clip: scene.clip.hash,
      spoken: scene.spoken.hash,
      frames: scene.durationFrames,
    })),
    params: {
      fps: timeline.fps,
      totalFrames: timeline.totalFrames,
      long: { width: longSpec.width, height: longSpec.height, crf: longSpec.crf, preset: longSpec.preset },
      short: { width: shortSpec.width, height: shortSpec.height, frames: shortFrames },
      loudness: longSpec.loudness,
      loudnessMode: 'two-pass-linear',
      musicGain: longSpec.musicGain,
    },
  });
}

function toRenderedFile(
  path: string,
  profile: RenderedFile['profile'],
  hash8: string,
  sha256: string,
  probe: { width: number | null; height: number | null; fps: number | null; frames: number | null; durationMs: number },
): RenderedFile {
  return {
    profile,
    path,
    pathFromAssets: assetsRelativePath(path),
    width: probe.width,
    height: probe.height,
    fps: probe.fps,
    frames: probe.frames,
    durationMs: probe.durationMs,
    bytes: statSync(path).size,
    sha256,
    hash8,
  };
}

function captionsFile(path: string, durationMs: number, hash8: string, sha256: string): RenderedFile {
  return {
    profile: 'legenda',
    path,
    pathFromAssets: assetsRelativePath(path),
    width: null,
    height: null,
    fps: null,
    frames: null,
    durationMs,
    bytes: statSync(path).size,
    sha256,
    hash8,
  };
}

/**
 * Renderiza o episódio inteiro (longo, Short e legenda) — ou **não faz nada**, quando já existe.
 *
 * O render é a etapa mais cara do pipeline. Por isso a primeira coisa que acontece é a conta do hash: se
 * o manifesto já tem esse hash e os três arquivos estão no disco, a função devolve o que existe, sem
 * chamar o ffmpeg. Reexecutar um episódio pronto não pode custar tempo nem dinheiro.
 */
export function renderEpisode(input: RenderEpisodeInput): RenderEpisodeResult {
  assertReadyToRender(input.timeline);
  const timeline = input.timeline;
  const longSpec = input.longSpec ?? LONG_RENDER_SPEC;
  const shortSpec = input.shortSpec ?? SHORT_RENDER_SPEC;
  const shortSeconds = input.shortMaxSeconds ?? MEDIA_LIMITS.shortMaxSeconds;

  const scope = input.scopeChannelId;
  const { channelId, episodeId, slug } = timeline;

  const manifest = readManifest(scope, channelId, episodeId);
  const longFrames = timeline.totalFrames;
  const shortFrames = Math.max(1, Math.min(Math.round(shortSeconds * timeline.fps), longFrames));
  const hash8 = renderInputHash(timeline, longSpec, shortSpec, shortFrames);
  const model = RENDER_MODEL.long;
  const sha256 = assetFingerprint({
    stage: 'render',
    promptVersion: 'render-v1',
    providerId: 'ffmpeg',
    model,
    input: { slug, timeline: timeline.scenes.map((scene) => scene.clip.hash) },
    params: { hash8, shortFrames, versionRule: 'hash-por-conteudo' },
  });
  const version = nextVersion(manifest, 'render', 'longo', hash8);

  const dir = renderDir(scope, channelId, episodeId, version);
  const longPath = renderPath(scope, channelId, episodeId, version, renderFileName(slug, 'longo-16x9', version, 'mp4'));
  const shortPath = renderPath(scope, channelId, episodeId, version, renderFileName(slug, 'short-9x16', version, 'mp4'));
  const srtPath = renderPath(scope, channelId, episodeId, version, renderFileName(slug, 'longo-16x9', version, 'srt'));

  const reusable = findReusable(manifest, 'render', 'longo', hash8);
  if (reusable !== undefined && existsSync(shortPath) && existsSync(srtPath)) {
    const longProbe = probeMedia(longPath);
    const shortProbe = probeMedia(shortPath);
    return {
      version: reusable.version,
      reused: true,
      long: toRenderedFile(longPath, 'longo-16x9', hash8, sha256, longProbe),
      short: toRenderedFile(shortPath, 'short-9x16', hash8, sha256, shortProbe),
      captions: captionsFile(srtPath, timeline.totalMs, hash8, sha256),
      loudness: measureLoudness(longPath),
      // Reanálise barata (áudio puro) para o relatório continuar dizendo em que modo o arquivo foi gerado,
      // mesmo quando ele veio do manifesto.
      voiceLoudness: timeline.voiceTrackPath === null ? null : analyzeLoudness(timeline.voiceTrackPath, longSpec.loudness),
      hash: hash8,
      sha256,
    };
  }

  if (timeline.music === null || timeline.voiceTrackPath === null) {
    throw new Error('Timeline incompleta: voz e trilha são obrigatórias para a montagem.');
  }

  mkdirSync(dir, { recursive: true });

  // --- loudness: passe 1 mede, passe 2 aplica ---------------------------------
  // Só a trilha de voz é analisada (áudio puro, barato). Com os números medidos, o `loudnorm` do render
  // aplica ganho **linear** e chega ao alvo; em passe único ele trabalha às cegas e ficava ~6 LU abaixo.
  const analysis = analyzeLoudness(timeline.voiceTrackPath, longSpec.loudness);
  const loudnormFilter =
    analysis === null
      ? `loudnorm=I=${longSpec.loudness.integratedLufs}:TP=${longSpec.loudness.truePeakDb}:LRA=${longSpec.loudness.lra}`
      : `loudnorm=I=${longSpec.loudness.integratedLufs}:TP=${longSpec.loudness.truePeakDb}:LRA=${longSpec.loudness.lra}` +
        `:measured_I=${analysis.inputIntegratedLufs}:measured_TP=${analysis.inputTruePeakDb}` +
        `:measured_LRA=${analysis.inputLra}:measured_thresh=${analysis.inputThresholdLufs}` +
        `:offset=${analysis.targetOffsetLu}:linear=true`;

  // --- longo -----------------------------------------------------------------
  const listFile = workPath(scope, channelId, episodeId, 'clipes.txt');
  ensureParentDir(listFile);
  writeFileSync(listFile, `${timeline.scenes.map((scene) => concatEntry(scene.clip.path)).join('\n')}\n`, 'utf8');

  runFfmpegOrThrow([
    '-y',
    '-hide_banner',
    '-loglevel',
    'error',
    '-f',
    'concat',
    '-safe',
    '0',
    '-i',
    listFile,
    '-i',
    timeline.voiceTrackPath,
    '-i',
    timeline.music.asset.path,
    '-filter_complex',
    // `normalize=0` no amix é obrigatório, e o motivo foi **medido** nesta sessão: por padrão o `amix`
    // divide cada entrada por 2 (normalização de mixagem), o que derruba a narração em 6 dB e desfaz
    // exatamente o `loudnorm` recém-aplicado — o arquivo saía em −20,1 LUFS com alvo −14. Com `normalize=0`,
    // o ganho calculado no passe 1 chega ao arquivo final e a trilha entra por baixo, no volume definido.
    `[1:a]${loudnormFilter}[voz];` +
      `[2:a]volume=${longSpec.musicGain}[bg];[voz][bg]amix=inputs=2:duration=longest:normalize=0[a]`,
    '-map',
    '0:v',
    '-map',
    '[a]',
    '-c:v',
    longSpec.videoCodec,
    '-preset',
    longSpec.preset,
    '-crf',
    String(longSpec.crf),
    '-pix_fmt',
    longSpec.pixelFormat,
    '-r',
    String(longSpec.fps),
    '-c:a',
    longSpec.audioCodec,
    '-b:a',
    longSpec.audioBitrate,
    // `-t` com a duração exata da timeline: sem isso o padding do AAC (e o atraso de inicialização do
    // codificador) fazem o contêiner ficar ~67 ms mais longo que o vídeo, e todo mundo que lê a duração do
    // arquivo — player, plataforma, custo por minuto — passa a ver um número que não é o da timeline.
    '-t',
    (timeline.totalFrames / longSpec.fps).toFixed(6),
    '-movflags',
    '+faststart',
    longPath,
  ]);

  const longProbe = probeMedia(longPath);
  const longVideoMs = longProbe.videoDurationMs ?? longProbe.durationMs;
  if (Math.abs(longVideoMs - timeline.totalMs) > 1000 / timeline.fps) {
    throw new Error(
      `O vídeo longo saiu com ${longVideoMs} ms de trilha de vídeo e a timeline tem ${timeline.totalMs} ms. ` +
        'Render que não corresponde à timeline contamina legenda e custo por minuto.',
    );
  }
  if (longProbe.frames !== null && longProbe.frames !== timeline.totalFrames) {
    throw new Error(
      `O vídeo longo saiu com ${longProbe.frames} quadros e a timeline tem ${timeline.totalFrames}. ` +
        'Contagem de quadros divergente é dessincronia garantida no fim do vídeo.',
    );
  }
  if (longProbe.width !== longSpec.width || longProbe.height !== longSpec.height) {
    throw new Error(
      `O vídeo longo saiu ${String(longProbe.width)}x${String(longProbe.height)}; esperado ${longSpec.width}x${longSpec.height}.`,
    );
  }

  // --- legenda ---------------------------------------------------------------
  const blocks = srtBlocks(timeline);
  assertSrtWithinVideo(blocks, timeline.totalMs);
  writeFileSync(srtPath, renderSrt(timeline), 'utf8');

  // --- Short -----------------------------------------------------------------
  runFfmpegOrThrow([
    '-y',
    '-hide_banner',
    '-loglevel',
    'error',
    '-i',
    longPath,
    '-frames:v',
    String(shortFrames),
    '-vf',
    'crop=ih*9/16:ih,scale=1080:1920',
    '-c:v',
    shortSpec.videoCodec,
    '-preset',
    shortSpec.preset,
    '-crf',
    String(shortSpec.crf),
    '-pix_fmt',
    shortSpec.pixelFormat,
    '-r',
    String(shortSpec.fps),
    '-c:a',
    shortSpec.audioCodec,
    '-b:a',
    shortSpec.audioBitrate,
    '-t',
    (shortFrames / shortSpec.fps).toFixed(6),
    '-movflags',
    '+faststart',
    shortPath,
  ]);

  const shortProbe = probeMedia(shortPath);
  if (shortProbe.width !== shortSpec.width || shortProbe.height !== shortSpec.height) {
    throw new Error(
      `O Short saiu ${String(shortProbe.width)}x${String(shortProbe.height)}; esperado ${shortSpec.width}x${shortSpec.height}. ` +
        'Vertical de verdade, não longo com tarja.',
    );
  }

  return {
    version,
    reused: false,
    long: toRenderedFile(longPath, 'longo-16x9', hash8, sha256, longProbe),
    short: toRenderedFile(shortPath, 'short-9x16', hash8, sha256, shortProbe),
    captions: captionsFile(srtPath, timeline.totalMs, hash8, sha256),
    loudness: measureLoudness(longPath),
    voiceLoudness: analysis,
    hash: hash8,
    sha256,
  };
}

/** Converte um `RenderedFile` no registro de manifesto — é o que entra no `meta.json`. */
export function renderedFileToAsset(
  file: RenderedFile,
  input: {
    readonly channelId: string;
    readonly episodeId: string;
    readonly stage: 'render' | 'legenda';
    readonly key: string;
    readonly version: number;
    readonly costUsd: number;
    readonly simulated: boolean;
    readonly promptVersion: string;
    readonly providerId: string;
    readonly model: string;
    readonly now: Date;
  },
): MediaAsset {
  return {
    channelId: input.channelId,
    episodeId: input.episodeId,
    stage: input.stage,
    // A legenda é arquivo de texto que acompanha o vídeo: `texto` diz exatamente isso, e evita que
    // alguém tente medir largura/altura de um `.srt`.
    kind: file.profile === 'legenda' ? 'texto' : 'video',
    key: input.key,
    version: input.version,
    path: repoRelativePath(file.path),
    pathFromAssets: file.pathFromAssets,
    hash: file.hash8,
    sha256: file.sha256,
    durationMs: file.durationMs,
    bytes: file.bytes,
    providerId: input.providerId,
    model: input.model,
    promptVersion: input.promptVersion,
    costUsd: input.costUsd,
    simulated: input.simulated,
    reference: 'sintetica',
    approved: false,
    recordedAt: input.now.toISOString(),
  };
}
