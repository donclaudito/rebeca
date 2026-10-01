/**
 * Provedores simulados — arquivos **de verdade** gerados pelo ffmpeg local, custo zero.
 *
 * Por que a Fase 0 existe assim, e não com "dados falsos":
 *
 * 1. O pipeline inteiro (timeline, montagem, render, Short, legenda, manifesto, custo) só se prova com
 *    arquivo real. Um mock que devolve uma string de caminho não prova nada: nem duração, nem
 *    sincronia, nem idempotência, nem formato de saída.
 * 2. A Fase 1 troca **só** o adapter (MiniMax/Luma/Azure/Suno atrás das mesmas interfaces). Se o
 *    simulado não exercitasse o mesmo contrato, a troca revelaria surpresas — e elas apareceriam
 *    justamente na primeira vez que alguém gastasse dinheiro.
 * 3. `costUsd: 0` e `simulated: true` são **verdade**, não placeholder: o ffmpeg desta máquina não
 *    cobra nada, e o campo `simulated` impede que um ativo sintético chegue ao humano parecendo
 *    conteúdo real (o `ADR-005` ainda exige rótulo *deep synthesis* quando o provedor for a MiniMax —
 *    mesmo campo, outro motivo).
 *
 * Nada aqui abre rede, lê chave de API ou escreve fora de `.rebeca/assets/<canal>/<episodio>/`.
 */

import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type {
  GeneratedAsset,
  ImageProvider,
  ImageRequest,
  MediaProviderSet,
  MusicProvider,
  MusicRequest,
  SpokenLine,
  TtsProvider,
  TtsRequest,
  VideoProvider,
  VideoRequest,
} from '../../../src/media/contract.js';
import { assetFingerprint } from '../hash.js';
import { assetPath, ensureParentDir } from '../paths.js';
import {
  assertFfmpegAvailable,
  escapeFilterOptionValue,
  FfmpegError,
  probeMedia,
  runFfmpegOrThrow,
} from '../ffmpeg.js';

export const SIMULATED_PROVIDER_IDS = {
  image: 'simulado-imagem',
  video: 'simulado-animacao',
  tts: 'simulado-voz',
  music: 'simulado-musica',
} as const;

/**
 * Identificador de modelo de cada provedor simulado.
 *
 * O sufixo numérico é a versão do **gerador**, não do ffmpeg: se a fórmula mudar (outra fonte, outro
 * movimento), o número sobe e **todos os hashes mudam de uma vez**. Reaproveitar o mesmo `model` com
 * fórmula diferente faria o pipeline reusar arquivo gerado por outra regra.
 */
export const SIMULATED_MODELS = {
  image: 'ffmpeg-lavfi-drawtext-1',
  video: 'ffmpeg-zoompan-1',
  tts: 'ffmpeg-tom-1',
  music: 'ffmpeg-tom-tremolo-1',
} as const;

/** Fala sintética é lida como fala: ~14,5 caracteres por segundo em pt-BR narrado. */
const CHARS_PER_SECOND = 14.5;
const MIN_SPEECH_MS = 1_200;
const SAMPLE_RATE = 48_000;

const SCENE_COLORS = ['0x1E293B', '0x3B1E3B', '0x1E3B2E', '0x3B2E1E', '0x241E3B', '0x3B1E24'] as const;

/** Assinatura de PNG. Serve para provar que o arquivo gerado **é** um PNG, e não um arquivo vazio. */
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/* =============================================================================
   Utilidades
   ============================================================================= */

/** Fonte de verdade do texto desenhado. Uma lista curta cobre Windows e Linux sem virar configuração. */
const FONT_CANDIDATES = [
  'C:/Windows/Fonts/arial.ttf',
  'C:/Windows/Fonts/segoeui.ttf',
  'C:/Windows/Fonts/calibri.ttf',
  '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
  '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
];

/**
 * Sem fonte, o `drawtext` não desenha — e a imagem sairia sem o texto da cena, calada.
 *
 * Falhar alto é a escolha certa: o texto é a única forma de olhar para o PNG e saber **qual** cena ele
 * representa. Imagem sem rótulo é asset que ninguém consegue auditar.
 */
export function resolveFontFile(): string {
  const configured = process.env['REBECA_FONT'];
  if (configured) {
    if (!isReadableFile(configured)) {
      throw new FfmpegError('ffmpeg-falhou', `REBECA_FONT aponta para "${configured}", que não existe.`);
    }
    return configured;
  }
  for (const candidate of FONT_CANDIDATES) {
    if (isReadableFile(candidate)) return candidate;
  }
  throw new FfmpegError(
    'ffmpeg-falhou',
    'Não encontrei nenhuma fonte TTF para o drawtext. Aponte REBECA_FONT para um arquivo .ttf — sem fonte o ' +
      'texto da cena não é desenhado e a imagem deixa de ser auditável.',
  );
}

function isReadableFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

/** Quebra o texto em linhas de largura legível. Legenda e imagem usam a mesma função. */
export function wrapText(text: string, width = 46): string {
  const words = text.replace(/\s+/g, ' ').trim().split(' ');
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

/**
 * Escreve o texto num arquivo temporário e devolve o caminho + a limpeza.
 *
 * O texto da cena vai por **arquivo** (`textfile=`), não por valor de opção. Motivo medido nesta sessão:
 * o parser do grafo de filtros roda antes do parser de opções, então aspas não protegem `:`, `,` e `%`, e
 * escapar texto livre para dentro do filtro é onde a pipeline quebra em silêncio — um `:` no meio da
 * narração vira erro de sintaxe do filtro. Com `expansion=none`, o conteúdo do arquivo é usado
 * literalmente, sem interpretar `%{...}`.
 */
function withTextFile<T>(text: string, body: (file: string) => T): T {
  const dir = mkdtempSync(join(tmpdir(), 'rebeca-texto-'));
  const file = join(dir, 'texto.txt');
  writeFileSync(file, `${text}\n`, 'utf8');
  try {
    return body(file);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Frequência determinística a partir do identificador da cena — a mesma cena soa sempre igual. */
function toneFrequency(seedText: string): number {
  let sum = 0;
  for (const char of seedText) sum = (sum + char.charCodeAt(0)) % 997;
  return 180 + (sum % 12) * 20;
}

/** Duração estimada da fala. É **pedido** ao gerador; o que vale na timeline é a duração medida. */
export function estimateSpeechMs(text: string): number {
  const clean = text.trim();
  if (clean.length === 0) {
    throw new FfmpegError('ffmpeg-falhou', 'Fala sem texto: não há o que sintetizar nem o que legendar.');
  }
  return Math.max(MIN_SPEECH_MS, Math.round((clean.length / CHARS_PER_SECOND) * 1000));
}

function assertFileProduced(path: string, what: string): void {
  const size = isReadableFile(path) ? statSync(path).size : 0;
  if (size <= 0) {
    throw new FfmpegError('ffmpeg-falhou', `O ffmpeg não produziu ${what} em "${path}" (arquivo ausente ou vazio).`);
  }
}

function assertPng(path: string): void {
  assertFileProduced(path, 'a imagem');
  const head = readFileSync(path).subarray(0, PNG_SIGNATURE.length);
  if (!head.equals(PNG_SIGNATURE)) {
    throw new FfmpegError('ffmpeg-falhou', `"${path}" não é um PNG válido (assinatura ausente).`);
  }
}

/* =============================================================================
   Imagem
   ============================================================================= */

/**
 * Plano de um ativo: onde ele vai nascer e qual é o hash da entrada.
 *
 * Existe separado do provedor porque o pipeline precisa saber **antes de gerar** se aquele ativo já
 * existe: é a checagem que evita pagar duas vezes. Deixar essa conta só dentro do `render()` faria o
 * pipeline chamar o provedor para descobrir o hash — e, com provedor pago, a chamada já teria custado.
 */
export interface AssetPlan {
  readonly hash: string;
  /** Fingerprint completo (64 hex) — vai ao manifesto para auditoria. */
  readonly sha256: string;
  readonly path: string;
}

export function planImage(input: ImageRequest): AssetPlan {
  const sha256 = assetFingerprint({
    stage: 'imagem',
    promptVersion: input.promptVersion,
    providerId: SIMULATED_PROVIDER_IDS.image,
    model: SIMULATED_MODELS.image,
    input: { sceneId: input.sceneId, prompt: input.prompt, onScreenText: input.onScreenText },
    params: { width: input.width, height: input.height, seed: input.seed },
  });
  const hash = sha256.slice(0, 8);
  return {
    hash,
    sha256,
    path: assetPath({
      scopeChannelId: input.scopeChannelId,
      channelId: input.channelId,
      episodeId: input.episodeId,
      stage: 'imagem',
      slug: input.sceneId,
      hash8: hash,
      ext: 'png',
    }),
  };
}

export const simulatedImageProvider: ImageProvider = {
  id: SIMULATED_PROVIDER_IDS.image,

  async render(input: ImageRequest): Promise<GeneratedAsset> {
    assertFfmpegAvailable();
    const { hash, path } = planImage(input);

    // Mesmo hash ⇒ mesmo nome ⇒ o arquivo já é o resultado. Regerar seria trabalho jogado fora (e, com
    // provedor pago, dinheiro jogado fora).
    if (!isReadableFile(path)) {
      const color = SCENE_COLORS[input.seed % SCENE_COLORS.length] ?? SCENE_COLORS[0];
      const font = escapeFilterOptionValue(resolveFontFile());
      const text = `${input.onScreenText}\n\n${wrapText(input.prompt, 68)}`;

      ensureParentDir(path);
      withTextFile(text, (textFile) => {
        runFfmpegOrThrow([
          '-y',
          '-hide_banner',
          '-loglevel',
          'error',
          '-f',
          'lavfi',
          '-i',
          `color=c=${color}:s=${input.width}x${input.height}`,
          '-frames:v',
          '1',
          '-vf',
          `drawtext=fontfile=${font}:textfile=${escapeFilterOptionValue(textFile)}:expansion=none:fontcolor=white:fontsize=56:line_spacing=16:x=(w-text_w)/2:y=(h-text_h)/2`,
          path,
        ]);
      });
      assertPng(path);
    }

    return {
      path,
      providerId: SIMULATED_PROVIDER_IDS.image,
      model: SIMULATED_MODELS.image,
      costUsd: 0,
      hash,
      simulated: true,
    };
  },
};

/* =============================================================================
   Animação (imagem → clipe curto)
   ============================================================================= */

export function planClip(input: VideoRequest): AssetPlan {
  const sha256 = assetFingerprint({
    stage: 'animacao',
    promptVersion: input.promptVersion,
    providerId: SIMULATED_PROVIDER_IDS.video,
    model: SIMULATED_MODELS.video,
    // A imagem de entrada entra pelo **hash**, não pelo caminho: caminho absoluto muda por máquina e
    // faria o mesmo clipe ter nome diferente em cada computador.
    input: { sceneId: input.sceneId, imageHash: input.imageHash, durationMs: input.durationMs, motion: input.motion },
    params: { width: input.width, height: input.height, fps: input.fps, frames: input.frames },
  });
  const hash = sha256.slice(0, 8);
  return {
    hash,
    sha256,
    path: assetPath({
      scopeChannelId: input.scopeChannelId,
      channelId: input.channelId,
      episodeId: input.episodeId,
      stage: 'animacao',
      slug: input.sceneId,
      hash8: hash,
      ext: 'mp4',
    }),
  };
}

export const simulatedVideoProvider: VideoProvider = {
  id: SIMULATED_PROVIDER_IDS.video,

  async animate(input: VideoRequest): Promise<GeneratedAsset> {
    assertFfmpegAvailable();
    if (!Number.isInteger(input.frames) || input.frames < 1) {
      throw new FfmpegError('ffmpeg-falhou', `Número de quadros inválido para o clipe: ${String(input.frames)}.`);
    }

    const { hash, path } = planClip(input);

    if (!isReadableFile(path)) {
      ensureParentDir(path);
      runFfmpegOrThrow([
        '-y',
        '-hide_banner',
        '-loglevel',
        'error',
        '-loop',
        '1',
        '-i',
        input.imagePath,
        // `-frames:v` em vez de `-t`: garante contagem **exata** de quadros. Com `-t` a duração flutua
        // em um quadro e a soma dos clipes diverge da soma das falas — a legenda sai do lugar.
        '-frames:v',
        String(input.frames),
        '-vf',
        "zoompan=z='min(1+0.0009*on,1.12)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=" +
          `${input.width}x${input.height}:fps=${input.fps},format=yuv420p`,
        '-an',
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-crf',
        '18',
        '-pix_fmt',
        'yuv420p',
        '-r',
        String(input.fps),
        path,
      ]);
      assertFileProduced(path, 'o clipe');
    }

    // Confere que o ffmpeg entregou o que foi pedido: um quadro de diferença aqui vira dessincronia
    // acumulada lá na frente, e o erro apareceria como "legenda atrasada", longe da causa.
    const probed = probeMedia(path);
    const expectedMs = (input.frames / input.fps) * 1000;
    if (Math.abs(probed.durationMs - expectedMs) > 1000 / input.fps) {
      throw new FfmpegError(
        'ffmpeg-falhou',
        `O clipe de "${input.sceneId}" saiu com ${probed.durationMs} ms, mas foram pedidos ${Math.round(expectedMs)} ms ` +
          '(tolerância de um quadro). Sem isso a timeline deixaria de corresponder ao vídeo.',
      );
    }

    return {
      path,
      providerId: SIMULATED_PROVIDER_IDS.video,
      model: SIMULATED_MODELS.video,
      costUsd: 0,
      hash,
      simulated: true,
    };
  },
};

/* =============================================================================
   Voz
   ============================================================================= */

export function planVoice(input: TtsRequest): AssetPlan {
  const sha256 = assetFingerprint({
    stage: 'voz',
    promptVersion: input.promptVersion,
    providerId: SIMULATED_PROVIDER_IDS.tts,
    model: SIMULATED_MODELS.tts,
    input: { sceneId: input.sceneId, text: input.text, voiceId: input.voiceId, lang: input.lang },
    params: { sampleRate: SAMPLE_RATE, charsPerSecond: CHARS_PER_SECOND },
  });
  const hash = sha256.slice(0, 8);
  return {
    hash,
    sha256,
    path: assetPath({
      scopeChannelId: input.scopeChannelId,
      channelId: input.channelId,
      episodeId: input.episodeId,
      stage: 'voz',
      slug: input.sceneId,
      hash8: hash,
      ext: 'wav',
    }),
  };
}

export const simulatedTtsProvider: TtsProvider = {
  id: SIMULATED_PROVIDER_IDS.tts,

  async synthesize(input: TtsRequest): Promise<SpokenLine> {
    assertFfmpegAvailable();
    const expectedMs = estimateSpeechMs(input.text);
    const { hash, path } = planVoice(input);

    if (!isReadableFile(path)) {
      ensureParentDir(path);
      runFfmpegOrThrow([
        '-y',
        '-hide_banner',
        '-loglevel',
        'error',
        '-f',
        'lavfi',
        '-i',
        `sine=frequency=${toneFrequency(input.sceneId)}:sample_rate=${SAMPLE_RATE}:duration=${(expectedMs / 1000).toFixed(3)}`,
        '-ac',
        '1',
        // Volume baixo de propósito: é um tom de verificação, não uma narração de mentira. Alto o
        // bastante para se ouvir que existe voz na faixa, baixo o bastante para não machucar quem revisa.
        '-af',
        'volume=0.06',
        '-c:a',
        'pcm_s16le',
        path,
      ]);
      assertFileProduced(path, 'a voz');
    }

    // A duração que MANDA é esta: medida do arquivo, não a que pedimos. Um fornecedor real entrega
    // duração diferente da solicitada, e é essa diferença que a timeline tem de absorver.
    const measured = probeMedia(path);
    return {
      path,
      providerId: SIMULATED_PROVIDER_IDS.tts,
      model: SIMULATED_MODELS.tts,
      costUsd: 0,
      hash,
      simulated: true,
      durationMs: measured.durationMs,
    };
  },
};

/* =============================================================================
   Música
   ============================================================================= */

export function planMusic(input: MusicRequest): AssetPlan {
  const sha256 = assetFingerprint({
    stage: 'musica',
    promptVersion: input.promptVersion,
    providerId: SIMULATED_PROVIDER_IDS.music,
    model: SIMULATED_MODELS.music,
    input: { mood: input.mood },
    params: { durationMs: input.durationMs, sampleRate: SAMPLE_RATE },
  });
  const hash = sha256.slice(0, 8);
  return {
    hash,
    sha256,
    path: assetPath({
      scopeChannelId: input.scopeChannelId,
      channelId: input.channelId,
      episodeId: input.episodeId,
      stage: 'musica',
      slug: 'trilha',
      hash8: hash,
      ext: 'wav',
    }),
  };
}

export const simulatedMusicProvider: MusicProvider = {
  id: SIMULATED_PROVIDER_IDS.music,

  async compose(input: MusicRequest): Promise<GeneratedAsset> {
    assertFfmpegAvailable();
    if (!Number.isFinite(input.durationMs) || input.durationMs <= 0) {
      throw new FfmpegError('ffmpeg-falhou', `Duração inválida para a trilha: ${String(input.durationMs)} ms.`);
    }

    const { hash, path } = planMusic(input);

    if (!isReadableFile(path)) {
      ensureParentDir(path);
      runFfmpegOrThrow([
        '-y',
        '-hide_banner',
        '-loglevel',
        'error',
        '-f',
        'lavfi',
        '-i',
        `sine=frequency=196:sample_rate=${SAMPLE_RATE}:duration=${(input.durationMs / 1000).toFixed(3)}`,
        '-ac',
        '1',
        '-af',
        'volume=0.2,tremolo=f=0.8:d=0.4',
        '-c:a',
        'pcm_s16le',
        path,
      ]);
      assertFileProduced(path, 'a trilha');
    }

    // A trilha precisa cobrir o episódio inteiro: se ela for mais curta, o `amix` com `duration=longest`
    // deixa o fim sem música e o defeito passa despercebido como "silêncio no final".
    const measured = probeMedia(path);
    if (Math.abs(measured.durationMs - input.durationMs) > 200) {
      throw new FfmpegError(
        'ffmpeg-falhou',
        `A trilha saiu com ${measured.durationMs} ms e o episódio tem ${input.durationMs} ms (tolerância de 200 ms).`,
      );
    }

    return {
      path,
      providerId: SIMULATED_PROVIDER_IDS.music,
      model: SIMULATED_MODELS.music,
      costUsd: 0,
      hash,
      simulated: true,
    };
  },
};

/**
 * O conjunto dos quatro, para o pipeline receber "um provedor de cada".
 *
 * Trocar de provedor na Fase 1 é trocar **este objeto** — nenhuma outra linha do pipeline muda. É o
 * invariante nº 7 (provedores substituíveis) em forma executável.
 */
export const SIMULATED_PROVIDERS: MediaProviderSet = {
  image: simulatedImageProvider,
  video: simulatedVideoProvider,
  tts: simulatedTtsProvider,
  music: simulatedMusicProvider,
};
