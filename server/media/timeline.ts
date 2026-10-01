/**
 * A timeline é a fonte da verdade.
 *
 * Regra da skill, e o motivo dela: **a duração da fala medida pelo TTS manda na duração da cena e no
 * tempo da legenda**. Se a cena tivesse duração "redonda" escolhida por nós, e a fala tivesse a duração
 * que o fornecedor entregou, o vídeo e o áudio divergiriam — e o defeito apareceria como "legenda
 * atrasada no fim do vídeo", longe da causa. Aqui só existe uma fonte de tempo, e ela é medida.
 *
 * O ponto delicado é o **arredondamento para quadro inteiro**. A 30 fps cada quadro vale 33,333 ms, e
 * não existe meio quadro: o ffmpeg recebe `-frames:v` inteiro. Duas armadilhas:
 *
 * 1. Quantizar a **duração de cada cena** acumula erro: 10 cenas × até 33 ms = 330 ms de atraso no fim,
 *    acima do teto de 200 ms que a skill exige entre fala e legenda.
 * 2. Quantizar a **soma acumulada** (o que este arquivo faz) mantém o erro limitado a meio quadro
 *    (~17 ms) em **qualquer** cena, porque cada fronteira é arredondada de novo a partir do tempo bruto
 *    acumulado. O erro não soma.
 *
 * E a voz é alinhada à mesma grade (`apad` até a duração quantizada da cena), então a fala começa
 * exatamente onde o quadro começa — o desvio fala↔legenda fica em zero, não em "quase zero".
 */

import type {
  EpisodeTimeline,
  GeneratedAsset,
  MusicTrack,
  SceneSpec,
  SpokenLine,
  TimelineScene,
} from '../../src/media/contract.js';

export interface ResolvedScene {
  readonly spec: SceneSpec;
  readonly spoken: SpokenLine;
  readonly image: GeneratedAsset;
  readonly clip: GeneratedAsset;
}

export interface BuildTimelineInput {
  readonly channelId: string;
  readonly episodeId: string;
  readonly slug: string;
  readonly fps: number;
  readonly scenes: readonly ResolvedScene[];
}

export interface SrtBlock {
  readonly index: number;
  readonly startMs: number;
  readonly endMs: number;
  readonly sceneId: string;
  readonly text: string;
}

/** Arredonda um instante para a fronteira de quadro mais próxima. Ver decisão nº 2 no topo. */
export function alignToFrame(ms: number, fps: number): number {
  const frameMs = 1000 / fps;
  return Math.round(ms / frameMs) * frameMs;
}

/** Fronteiras de tempo/quadro de uma cena, já quantizadas. */
export interface FrameSpan {
  readonly startFrame: number;
  readonly endFrame: number;
  readonly durationFrames: number;
  readonly startMs: number;
  readonly endMs: number;
  readonly durationMs: number;
}

export interface FramePlan {
  readonly spans: readonly FrameSpan[];
  readonly totalFrames: number;
  readonly totalMs: number;
  readonly rawTotalMs: number;
  readonly maxDriftMs: number;
}

/**
 * Converte durações medidas em fronteiras de quadro.
 *
 * **Precisa ser chamada antes de gerar os clipes**: o clipe tem de ter exatamente
 * `durationFrames` quadros, senão o vídeo montado não corresponde à timeline. Por isso é função pura e
 * exportada — o pipeline e a timeline usam a mesma conta, e não duas parecidas.
 */
export function planFrames(durationsMs: readonly number[], fps: number, ids: readonly string[] = []): FramePlan {
  const frameMs = 1000 / fps;
  const spans: FrameSpan[] = [];
  let frameCursor = 0;
  let rawCursorMs = 0;
  let maxDriftMs = 0;

  durationsMs.forEach((durationMs, position) => {
    if (!Number.isFinite(durationMs) || durationMs <= 0) {
      const label = ids[position] ?? String(position + 1);
      throw new Error(
        `A fala de "${label}" não tem duração medida (${String(durationMs)} ms). ` +
          'Sem duração medida a timeline seria inventada — a fonte da verdade é o arquivo de voz.',
      );
    }

    const startFrame = frameCursor;
    const rawEndMs = rawCursorMs + durationMs;
    const endFrame = Math.round(rawEndMs / frameMs);
    const durationFrames = endFrame - startFrame;
    if (durationFrames < 1) {
      const label = ids[position] ?? String(position + 1);
      throw new Error(`A cena "${label}" ficou com menos de um quadro (${durationFrames}).`);
    }

    const startMs = Math.round(startFrame * frameMs);
    const endMs = Math.round(endFrame * frameMs);
    // Desvio entre a legenda (grade de quadros) e a fala bruta acumulada.
    maxDriftMs = Math.max(maxDriftMs, Math.abs(startMs - rawCursorMs));

    spans.push({ startFrame, endFrame, durationFrames, startMs, endMs, durationMs: endMs - startMs });
    frameCursor = endFrame;
    rawCursorMs = rawEndMs;
  });

  const totalMs = Math.round(frameCursor * frameMs);
  return {
    spans,
    totalFrames: frameCursor,
    totalMs,
    rawTotalMs: Math.round(rawCursorMs),
    maxDriftMs: Math.max(maxDriftMs, Math.abs(totalMs - rawCursorMs)),
  };
}

/**
 * Monta a timeline a partir das falas **medidas**.
 *
 * `maxDriftMs` é o desvio máximo entre o início de legenda (grade de quadros) e o início bruto da fala
 * (soma das durações medidas). Ele é calculado aqui e conferido no teste — não é promessa, é medida.
 */
export function buildTimeline(input: BuildTimelineInput): EpisodeTimeline {
  if (input.scenes.length === 0) {
    throw new Error('Timeline sem cenas: não há o que renderizar nem o que legendar.');
  }
  const ordered = [...input.scenes].sort((a, b) => a.spec.index - b.spec.index);
  const plan = planFrames(
    ordered.map((scene) => scene.spoken.durationMs),
    input.fps,
    ordered.map((scene) => scene.spec.id),
  );

  const scenes: TimelineScene[] = ordered.map((scene, position) => {
    const span = plan.spans[position];
    if (span === undefined) throw new Error('Plano de quadros incompleto — defeito interno da timeline.');
    return {
      spec: scene.spec,
      startMs: span.startMs,
      endMs: span.endMs,
      durationMs: span.durationMs,
      startFrame: span.startFrame,
      endFrame: span.endFrame,
      durationFrames: span.durationFrames,
      spoken: scene.spoken,
      image: scene.image,
      clip: scene.clip,
    };
  });

  return {
    channelId: input.channelId,
    episodeId: input.episodeId,
    slug: input.slug,
    fps: input.fps,
    scenes,
    totalMs: plan.totalMs,
    totalFrames: plan.totalFrames,
    voiceTrackPath: null,
    music: null,
    maxDriftMs: plan.maxDriftMs,
  };
}

/** Anexa a faixa de voz alinhada (produzida na montagem). */
export function withVoiceTrack(timeline: EpisodeTimeline, voiceTrackPath: string): EpisodeTimeline {
  return { ...timeline, voiceTrackPath };
}

/** Anexa a trilha. A duração é medida do arquivo, não presumida. */
export function withMusic(timeline: EpisodeTimeline, music: MusicTrack): EpisodeTimeline {
  return { ...timeline, music };
}

/** O render exige voz alinhada e trilha: sem isso, "pronto" seria falso. */
export function assertReadyToRender(timeline: EpisodeTimeline): void {
  if (timeline.voiceTrackPath === null) {
    throw new Error('A timeline ainda não tem faixa de voz alinhada — a montagem precisa rodar antes do render.');
  }
  if (timeline.music === null) {
    throw new Error('A timeline ainda não tem trilha — o render mistura voz e música, e sem trilha a mixagem mudaria.');
  }
}

/* =============================================================================
   Legenda (.srt) da MESMA timeline
   ============================================================================= */

/** `HH:MM:SS,mmm` — formato do SubRip. Vírgula, não ponto. */
export function srtTimestamp(ms: number): string {
  const clamped = Math.max(0, Math.round(ms));
  const hours = Math.floor(clamped / 3_600_000);
  const minutes = Math.floor((clamped % 3_600_000) / 60_000);
  const seconds = Math.floor((clamped % 60_000) / 1000);
  const millis = clamped % 1000;
  const pad = (value: number, size = 2) => String(value).padStart(size, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)},${pad(millis, 3)}`;
}

/** Limpa o texto para o formato: sem `-->`, sem quebra de linha, sem espaço sobrando. */
export function sanitizeCaptionText(text: string): string {
  return text
    .replace(/-->/g, '→')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Quebra em linhas legíveis — a mesma largura usada no texto da imagem. */
export function wrapCaption(text: string, width = 42): string {
  const clean = sanitizeCaptionText(text);
  if (clean.length <= width) return clean;
  const words = clean.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if (current.length === 0) current = word;
    else if (`${current} ${word}`.length <= width) current = `${current} ${word}`;
    else {
      lines.push(current);
      current = word;
    }
  }
  if (current.length > 0) lines.push(current);
  return lines.join('\n');
}

/** Blocos de legenda: um por cena, com os tempos vindos da timeline — não de uma segunda conta. */
export function srtBlocks(timeline: EpisodeTimeline): SrtBlock[] {
  return timeline.scenes.map((scene, index) => ({
    index: index + 1,
    startMs: scene.startMs,
    endMs: scene.endMs,
    sceneId: scene.spec.id,
    text: wrapCaption(scene.spec.narration),
  }));
}

/**
 * Nenhum bloco começa depois do fim do vídeo, e nenhum termina além dele.
 *
 * Lançar em vez de recortar em silêncio: um bloco depois do fim significa que a timeline e o arquivo
 * renderizado discordam, e "consertar" a legenda esconderia exatamente o defeito que se quer detectar.
 */
export function assertSrtWithinVideo(blocks: readonly SrtBlock[], totalMs: number): void {
  for (const block of blocks) {
    if (block.startMs >= totalMs) {
      throw new Error(
        `A legenda do bloco ${block.index} (${block.sceneId}) começa em ${block.startMs} ms, depois do fim do vídeo (${totalMs} ms).`,
      );
    }
    if (block.endMs > totalMs) {
      throw new Error(
        `A legenda do bloco ${block.index} (${block.sceneId}) termina em ${block.endMs} ms, além do fim do vídeo (${totalMs} ms).`,
      );
    }
    if (block.endMs <= block.startMs) {
      throw new Error(`A legenda do bloco ${block.index} (${block.sceneId}) tem duração não positiva.`);
    }
  }
}

/** Conteúdo completo do `.srt`. */
export function renderSrt(timeline: EpisodeTimeline): string {
  const blocks = srtBlocks(timeline);
  assertSrtWithinVideo(blocks, timeline.totalMs);
  return (
    blocks
      .map(
        (block) =>
          `${block.index}\n${srtTimestamp(block.startMs)} --> ${srtTimestamp(block.endMs)}\n${block.text}\n`,
      )
      .join('\n') + '\n'
  );
}
