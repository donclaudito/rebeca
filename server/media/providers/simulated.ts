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
  AssetPlan,
  GeneratedAsset,
  ImageProvider,
  ImageRequest,
  MediaProviderSet,
  MusicProvider,
  MusicRequest,
  SpokenLine,
  ThumbnailProvider,
  ThumbnailRequest,
  TtsProvider,
  TtsRequest,
  VideoProvider,
  VideoRequest,
} from '../../../src/media/contract.js';

import { buildBackdropFilters, buildThumbnailBackground, type LocalThumbnailLayout } from '../thumbnail-art.js';

/**
 * Reexportado porque este arquivo foi o dono do tipo até a Fase 1 precisar dele.
 *
 * O `AssetPlan` nasceu aqui (só o simulado planejava ativos). Quando o adapter pago da MiniMax passou a
 * precisar do mesmo tipo, deixá-lo neste arquivo faria o provedor **real** importar do **simulado** — uma
 * dependência invertida que só apareceria no dia da troca de fornecedor. O tipo foi para o contrato e
 * esta linha mantém os importadores antigos funcionando.
 */
export type { AssetPlan };
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
  thumbnail: 'simulado-thumbnail',
} as const;

/**
 * Identificador de modelo de cada provedor simulado.
 *
 * O sufixo numérico é a versão do **gerador**, não do ffmpeg: se a fórmula mudar (outra fonte, outro
 * movimento), o número sobe e **todos os hashes mudam de uma vez**. Reaproveitar o mesmo `model` com
 * fórmula diferente faria o pipeline reusar arquivo gerado por outra regra.
 */
export const SIMULATED_MODELS = {
  image: 'ffmpeg-lavfi-drawtext-2',
  video: 'ffmpeg-zoompan-1',
  tts: 'ffmpeg-tom-1',
  music: 'ffmpeg-tom-tremolo-1',
  // `-2`: a fórmula mudou (duas passagens de drawtext, fonte calculada em vez de fixa). O número **sobe**
  // porque o hash entra no nome do arquivo — sem isso, o pipeline reusaria os PNGs cortados como se fossem
  // o resultado da fórmula nova, e o conserto não apareceria em nenhuma tela.
  thumbnail: 'ffmpeg-lavfi-drawtext-thumb-2',
} as const;

/**
 * Estimativa de ritmo da fala **sintética**, em caracteres por segundo.
 *
 * Premissa NOSSA, não fato de provedor: dá duração determinística ao áudio simulado e alimenta a
 * estimativa de entrada do portão. O provedor real entrega a duração **medida** por `ffprobe`, e é
 * essa medida que a timeline usa — este número não entra no caminho pago. (O valor estava sem
 * procedência declarada; achado de gravidade baixa do `rebeca-qa`.)
 */
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
 * Fator de largura média por caractere.
 *
 * **0,68, e não 0,55** — a diferença foi medida na tela do dono do produto. A primeira versão usava 0,55,
 * que é a média de texto em caixa mista; mas os títulos da thumbnail saem em **CAIXA ALTA** (o alfabeto
 * maiúsculo é ~30% mais largo), e o cálculo dizia que "BORBOLETAS E COR" cabia a 132 px quando o desenho
 * real ocupava ~1.430 px num canvas de 1.280. O `fontSizeQueCabe` então **não encolhia**, e o título
 * transbordou o painel dos dois lados.
 *
 * O erro não era de precisão: era de **otimismo**. Estimar a largura **para menos** produz exatamente o
 * defeito que a estimativa existe para evitar, e o ffmpeg não avisa — ele desenha fora do quadro em
 * silêncio. Na dúvida, superestimar: o custo de uma fonte um pouco menor é cosmético; o de texto cortado
 * é uma imagem inútil.
 */
const FATOR_LARGURA = 0.68;

/**
 * Largura média de um caractere, em pixels, para a fonte sans usada no `drawtext`.
 *
 * **Por que existe:** o `drawtext` do ffmpeg **não** recorta, não encolhe e não avisa — ele desenha, e o
 * que passa da borda simplesmente some. Sem estimar a largura, o texto some **em silêncio**. Foi o que
 * aconteceu duas vezes: uma hipótese de ~60 caracteres a 96 px virou linha de ~2.500 px num canvas de
 * 1.280, e depois um título em caixa alta passou no cálculo e transbordou no desenho.
 */
export function larguraEstimadaDoTexto(texto: string, fontsize: number): number {
  return texto.length * fontsize * FATOR_LARGURA;
}

/**
 * Quantos caracteres cabem numa linha, com essa fonte, sobrando margem nas laterais.
 *
 * A margem de 6% por lado existe porque texto encostado na borda fica ilegível na régua da skill
 * (`rebeca-branding`: legível a 168×94 px) — e porque o canto inferior direito é onde a plataforma
 * sobrepõe a duração do vídeo.
 */
export function caracteresPorLinha(fontsize: number, larguraCanvas: number, margem = 0.06): number {
  const util = larguraCanvas * (1 - 2 * margem);
  return Math.max(8, Math.floor(util / (fontsize * 0.55)));
}

/**
 * Maior tamanho de fonte (até `maximo`) em que o texto cabe na largura, **sem quebrar linha**.
 *
 * Existe para o texto da arte, que é curto por regra (3–4 palavras) e deve ficar grande — mas não a ponto
 * de sair da tela. Se nem no mínimo couber, devolve o mínimo: nada aqui corta texto em silêncio, e o
 * chamador tem como conferir com `textoCabeNoCanvas`.
 */
export function fontSizeQueCabe(
  texto: string,
  larguraCanvas: number,
  maximo: number,
  minimo = 28,
  margem = 0.06,
): number {
  const util = larguraCanvas * (1 - 2 * margem);
  for (let tamanho = maximo; tamanho > minimo; tamanho -= 2) {
    if (larguraEstimadaDoTexto(texto, tamanho) <= util) return tamanho;
  }
  return minimo;
}

/** O texto inteiro cabe, linha por linha, na largura disponível? */
export function textoCabeNoCanvas(texto: string, fontsize: number, larguraCanvas: number, margem = 0.06): boolean {
  const util = larguraCanvas * (1 - 2 * margem);
  return texto
    .split('\n')
    .every((linha) => larguraEstimadaDoTexto(linha, fontsize) <= util);
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

/**
 * Mesma ideia, com **vários** textos — cada um no seu arquivo.
 *
 * A thumbnail precisa de duas passagens de `drawtext` com tamanhos diferentes (o texto da arte grande, a
 * hipótese pequena embaixo). Uma passagem só obrigaria as duas a dividir a mesma fonte, e foi assim que a
 * hipótese longa empurrou o texto da arte para fora do quadro.
 */
function withTextFiles<T>(textos: readonly string[], body: (files: readonly string[]) => T): T {
  const dir = mkdtempSync(join(tmpdir(), 'rebeca-textos-'));
  const files = textos.map((texto, index) => {
    const file = join(dir, `texto-${index}.txt`);
    writeFileSync(file, `${texto}\n`, 'utf8');
    return file;
  });
  try {
    return body(files);
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
 * A definição canônica vive no contrato (`src/media/contract.ts`); este arquivo só reexporta.
 */
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
  model: SIMULATED_MODELS.image,
  simulated: true,

  async render(input: ImageRequest): Promise<GeneratedAsset> {
    assertFfmpegAvailable();
    const { hash, path } = planImage(input);

    // Mesmo hash ⇒ mesmo nome ⇒ o arquivo já é o resultado. Regerar seria trabalho jogado fora (e, com
    // provedor pago, dinheiro jogado fora).
    if (!isReadableFile(path)) {
      const color = SCENE_COLORS[input.seed % SCENE_COLORS.length] ?? SCENE_COLORS[0];
      const font = escapeFilterOptionValue(resolveFontFile());
      /*
       * A largura da linha é **calculada** a partir da fonte e do canvas.
       *
       * Estava fixa em 68 caracteres, e a 56 px isso dá ~2.100 px num canvas de 1.920: o mesmo corte
       * silencioso que apareceu na thumbnail. Aqui o defeito era anterior e ninguém tinha visto, porque
       * imagem de cena com texto de exemplo ninguém abre.
       */
      const fonte = 56;
      const text = `${input.onScreenText}\n\n${wrapText(input.prompt, caracteresPorLinha(fonte, input.width))}`;

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
          `drawtext=fontfile=${font}:textfile=${escapeFilterOptionValue(textFile)}:expansion=none:fontcolor=white:fontsize=${fonte}:line_spacing=16:x=(w-text_w)/2:y=(h-text_h)/2`,
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
  model: SIMULATED_MODELS.video,
  simulated: true,

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
  model: SIMULATED_MODELS.tts,
  simulated: true,

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
  model: SIMULATED_MODELS.music,
  simulated: true,

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
 * Thumbnail simulada — 1280×720 com o texto da arte desenhado, custo zero.
 *
 * Por que existe, se a Fase 1 já tem adapter real: sem ele, o caminho de **quatro opções** (numeração,
 * hash por opção, idempotência, portão de custo, ida ao manifesto) nunca seria exercitado por teste sem
 * gastar dinheiro. É o mesmo papel que o simulado cumpre no resto do pipeline: provar a máquina antes de
 * ligar o cartão.
 *
 * O que ele **não** faz: arte. O PNG é o texto sobre um fundo chapado — serve para provar o encanamento e
 * para o humano conferir legibilidade a 168×94, não para publicar. `simulated: true` diz isso no manifesto.
 */
export function planThumbnail(input: ThumbnailRequest): AssetPlan {
  const sha256 = assetFingerprint({
    stage: 'thumbnail',
    promptVersion: input.promptVersion,
    providerId: SIMULATED_PROVIDER_IDS.thumbnail,
    model: SIMULATED_MODELS.thumbnail,
    input: { optionId: input.optionId, prompt: input.prompt, textOnImage: input.textOnImage },
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
      stage: 'thumbnail',
      slug: `opcao-${input.optionId}`,
      hash8: hash,
      ext: 'png',
    }),
  };
}

export const simulatedThumbnailProvider: ThumbnailProvider = {
  id: SIMULATED_PROVIDER_IDS.thumbnail,
  model: SIMULATED_MODELS.thumbnail,
  simulated: true,
  costPerImageUsd: 0,

  plan: planThumbnail,

  async generate(input: ThumbnailRequest): Promise<GeneratedAsset> {
    assertFfmpegAvailable();
    const { hash, path } = planThumbnail(input);

    if (!isReadableFile(path)) {
      const font = escapeFilterOptionValue(resolveFontFile());
      /*
       * Camada visual (fundo, arco-íris do rodapé, painel claro) vem de `server/media/thumbnail-art.ts`;
       * o **texto** continua com o cálculo deste arquivo (tamanho que cabe + quebra em linhas). O texto
       * mudou de branco para escuro porque agora ele fica sobre um painel claro.
       */
      const layout: LocalThumbnailLayout = {
        width: input.width,
        height: input.height,
        textOnImage: input.textOnImage,
        hypothesis: input.hypothesis,
        seed: input.seed,
      };

      /*
       * Duas passagens de `drawtext`, com papéis diferentes — e a separação é o conserto.
       *
       * O texto da ARTE é curto por regra (3–4 palavras) e fica grande; o tamanho é **calculado** para
       * caber, não escolhido no chute. A hipótese é **metadado para quem opera**, não texto de thumbnail:
       * vai pequena e quebrada em linhas que cabem.
       *
       * Antes disto havia uma passagem só, com as duas coisas na mesma fonte de 96 px. A hipótese de ~60
       * caracteres virou uma linha de ~2.500 px num canvas de 1.280, o `drawtext` desenhou sem reclamar, e
       * o arquivo saiu cortado nas duas pontas — com o texto da arte fora do quadro.
       */
      const fonteArte = fontSizeQueCabe(input.textOnImage, input.width, 132, 48);
      const fonteNota = 34;
      const nota = wrapText(`(${input.optionId}) ${input.hypothesis}`, caracteresPorLinha(fonteNota, input.width));

      ensureParentDir(path);
      withTextFiles([input.textOnImage, nota], (arquivos) => {
        const [arteFile, notaFile] = arquivos;
        // `noUncheckedIndexedAccess` deixa os dois como `string | undefined`. Falhar alto é melhor que
        // gerar um `textfile=` vazio e descobrir na imagem sem texto.
        if (arteFile === undefined || notaFile === undefined) {
          throw new FfmpegError('ffmpeg-falhou', 'Os arquivos de texto da thumbnail não foram criados.');
        }
        runFfmpegOrThrow([
          '-y',
          '-hide_banner',
          '-loglevel',
          'error',
          '-f',
          'lavfi',
          '-i',
          buildThumbnailBackground(layout),
          '-frames:v',
          '1',
          '-vf',
          [
            ...buildBackdropFilters(layout),
            `drawtext=fontfile=${font}:textfile=${escapeFilterOptionValue(arteFile)}:expansion=none:fontcolor=0x111827:fontsize=${fonteArte}:x=(w-text_w)/2:y=(h/2-text_h/2)-56`,
            `drawtext=fontfile=${font}:textfile=${escapeFilterOptionValue(notaFile)}:expansion=none:fontcolor=0x475569:fontsize=${fonteNota}:line_spacing=12:x=(w-text_w)/2:y=(h/2)+64`,
          ].join(','),
          path,
        ]);
      });
      assertPng(path);
    }

    return {
      path,
      providerId: SIMULATED_PROVIDER_IDS.thumbnail,
      model: SIMULATED_MODELS.thumbnail,
      costUsd: 0,
      hash,
      simulated: true,
    };
  },
};

/**
 * O conjunto dos provedores, para o pipeline receber "um de cada".
 *
 * Trocar de provedor na Fase 1 é trocar **este objeto** — nenhuma outra linha do pipeline muda. É o
 * invariante nº 7 (provedores substituíveis) em forma executável.
 */
export const SIMULATED_PROVIDERS: MediaProviderSet = {
  image: simulatedImageProvider,
  video: simulatedVideoProvider,
  tts: simulatedTtsProvider,
  music: simulatedMusicProvider,
  thumbnail: simulatedThumbnailProvider,
};
