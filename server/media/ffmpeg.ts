/**
 * Ponte com o ffmpeg/ffprobe desta máquina.
 *
 * Três decisões que valem explicação, porque as três já custaram tempo:
 *
 * 1. **A saída é capturada por descritor de arquivo, não por `stdio: 'pipe'`.**
 *    Em ambiente confinado, o processo não pode abrir *named pipe*: `spawnSync` com a configuração
 *    padrão (`pipe`) falha com `EPERM` e o ffmpeg nunca chega a rodar. O caminho de arquivo
 *    (`stdio: ['ignore', fdOut, fdErr]`) não passa por pipe nenhum, funciona nos dois ambientes e ainda
 *    deixa o log do ffmpeg em disco — que é justamente o que se quer ler quando o render falha. O
 *    sintoma do `EPERM` foi medido nesta sessão, mas **não** virou arquivo de evidência: a citação
 *    anterior apontava para `.rebeca/evidencias/f0-ffmpeg-sem-pipe.txt`, que não existe (achado do
 *    `rebeca-qa`). O que existe é o caminho alternativo funcionando — os testes de render rodam ffmpeg
 *    de verdade e passam.
 * 2. **O escape de filtro é de dois níveis.** O `drawtext` recebe o caminho de uma fonte do Windows, e
 *    `C:` dentro de um valor de opção de filtro não é protegido por aspas — o parser do grafo de filtros
 *    consome o `:` como separador e o filtro inteiro vira erro de sintaxe. O que funciona (medido) é
 *    escapar a barra invertida e o dois-pontos (`C\\:/...`). Por isso `escapeFilterOptionValue` existe e
 *    por isso o **texto** da cena vai por `textfile=`, com o conteúdo literal do arquivo: escapar texto
 *    livre para dentro de um filtro é onde essa pipeline quebra em silêncio.
 * 3. **Falha de ffmpeg lança com o fim do log.** "exit 1" não diz a ninguém o que fazer; as últimas
 *    linhas do stderr dizem.
 */

import { spawnSync } from 'node:child_process';
import { closeSync, mkdtempSync, openSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** Teto de uma execução de ffmpeg. Render de episódio longo não é instantâneo; travar para sempre é pior. */
const FFMPEG_TIMEOUT_MS = 15 * 60 * 1000;

export class FfmpegError extends Error {
  readonly code: 'ffmpeg-ausente' | 'ffmpeg-falhou' | 'filtro-invalido';

  constructor(code: FfmpegError['code'], message: string) {
    super(message);
    this.name = 'FfmpegError';
    this.code = code;
  }
}

/** Caminho do binário, com sobreposição por ambiente para quem tem uma build específica. */
export function ffmpegPath(): string {
  return process.env['REBECA_FFMPEG'] ?? 'ffmpeg';
}

export function ffprobePath(): string {
  return process.env['REBECA_FFPROBE'] ?? 'ffprobe';
}

interface CaptureResult {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly spawnError: string | null;
}

/**
 * Roda um binário e devolve stdout/stderr como texto.
 *
 * Sem `pipe`: dois arquivos temporários servem de destino (ver decisão nº 1 no topo do arquivo).
 */
function capture(command: string, args: readonly string[], cwd: string | undefined): CaptureResult {
  const workDir = mkdtempSync(join(tmpdir(), 'rebeca-ff-'));
  const outFile = join(workDir, 'stdout.txt');
  const errFile = join(workDir, 'stderr.txt');
  const outFd = openSync(outFile, 'w');
  const errFd = openSync(errFile, 'w');

  let status: number | null = null;
  let spawnError: string | null = null;
  try {
    const result = spawnSync(command, [...args], {
      cwd,
      stdio: ['ignore', outFd, errFd],
      timeout: FFMPEG_TIMEOUT_MS,
      windowsHide: true,
    });
    status = result.status;
    if (result.error) {
      const code = (result.error as NodeJS.ErrnoException).code ?? 'desconhecido';
      spawnError = `${code}: ${result.error.message}`;
    }
  } finally {
    closeSync(outFd);
    closeSync(errFd);
  }

  const stdout = readFileSync(outFile, 'utf8');
  const stderr = readFileSync(errFile, 'utf8');
  rmSync(workDir, { recursive: true, force: true });

  return { status, stdout, stderr, spawnError };
}

/** Últimas linhas do log — é o que se lê de um erro de ffmpeg. */
function tail(text: string, lines = 12): string {
  const all = text.trim().split(/\r?\n/);
  return all.slice(Math.max(0, all.length - lines)).join(' | ');
}

export interface FfmpegRun {
  readonly ok: boolean;
  readonly status: number | null;
  /** Fim do log — é o que se lê de um erro de ffmpeg. */
  readonly log: string;
  /**
   * Log completo do stderr.
   *
   * Existe porque o resumo do `loudnorm` sai **no meio** do stderr: cortar as últimas linhas (o que faz
   * sentido para erro) apaga exatamente o que se quer medir. Medido nesta sessão: com o log truncado,
   * `parseLoudnessSummary` devolvia `null` e o relatório dizia "não foi possível medir" sobre um áudio
   * perfeitamente medível.
   */
  readonly fullLog: string;
}

/**
 * Executa o ffmpeg. Devolve `ok: false` com o log em vez de lançar: o chamador decide se aquilo é fatal
 * (render principal) ou tolerável (medir loudness de um arquivo que pode não ter áudio).
 */
export function runFfmpeg(args: readonly string[], cwd?: string): FfmpegRun {
  const result = capture(ffmpegPath(), args, cwd);
  if (result.spawnError) {
    const motivo = `falha ao iniciar o ffmpeg (${result.spawnError})`;
    return { ok: false, status: null, log: motivo, fullLog: `${motivo}\n${result.stderr}` };
  }
  return { ok: result.status === 0, status: result.status, log: tail(result.stderr), fullLog: result.stderr };
}

/** Igual a `runFfmpeg`, mas lança quando falha. Para o que não pode falhar em silêncio. */
export function runFfmpegOrThrow(args: readonly string[], cwd?: string): void {
  const run = runFfmpeg(args, cwd);
  if (!run.ok) {
    throw new FfmpegError(
      'ffmpeg-falhou',
      `O ffmpeg falhou (status ${String(run.status)}). Últimas linhas do log: ${run.log}`,
    );
  }
}

let availabilityCache: boolean | null = null;

/**
 * O ffmpeg está no PATH?
 *
 * Cacheado porque é consultado antes de cada etapa e por `it.skipIf` nos testes. Sem cache, um render
 * com 20 chamadas faria 20 sondagens.
 */
export function ffmpegAvailable(): boolean {
  if (availabilityCache !== null) return availabilityCache;
  const result = capture(ffmpegPath(), ['-version'], undefined);
  availabilityCache = result.status === 0 && result.spawnError === null;
  return availabilityCache;
}

/** Só para teste: esquece a sondagem. */
export function resetFfmpegAvailabilityCache(): void {
  availabilityCache = null;
}

/** Lança com mensagem acionável quando o binário não está disponível. */
export function assertFfmpegAvailable(): void {
  if (!ffmpegAvailable()) {
    throw new FfmpegError(
      'ffmpeg-ausente',
      `O ffmpeg não está disponível (procurei "${ffmpegPath()}" no PATH). A Fase 0 depende dele para gerar ` +
        'arquivos de verdade; instale o ffmpeg ou aponte REBECA_FFMPEG para o binário.',
    );
  }
}

/* =============================================================================
   Escape de filtro
   ============================================================================= */

/**
 * Caracteres que **não** sabemos escapar com segurança dentro de um valor de opção de filtro.
 *
 * A lista é curta e conservadora de propósito: o caminho de um ativo nosso é feito de `[a-z0-9-]`, então
 * qualquer um destes aqui significa que alguém montou um caminho por fora do módulo de caminhos. Recusar
 * é melhor que gerar um filtro que "quase" funciona.
 */
const FORBIDDEN_IN_FILTER = /[,;'"\[\]\r\n%]/;

export function assertFilterSafe(value: string, what: string): string {
  if (FORBIDDEN_IN_FILTER.test(value)) {
    throw new FfmpegError(
      'filtro-invalido',
      `O ${what} contém caractere que não pode ser escapado com segurança no grafo de filtros: "${value}".`,
    );
  }
  return value;
}

/**
 * Escapa um valor de opção de filtro (caminho de arquivo, na prática).
 *
 * O parser do grafo de filtros roda **antes** do parser de opções: uma barra invertida consumida no
 * primeiro nível chega ao segundo como escape. Por isso o dois-pontos precisa de duas barras
 * (`C\\:`), e não de aspas — aspas simples **não** protegem o `:` (medido nesta sessão).
 */
export function escapeFilterOptionValue(value: string): string {
  return assertFilterSafe(value, 'caminho de filtro')
    .replace(/\\/g, '/')
    .replace(/:/g, '\\\\:');
}

/* =============================================================================
   ffprobe
   ============================================================================= */

interface ProbeJson {
  readonly streams?: readonly {
    readonly codec_type?: string;
    readonly width?: number;
    readonly height?: number;
    readonly r_frame_rate?: string;
    readonly avg_frame_rate?: string;
    readonly nb_frames?: string;
    readonly duration?: string;
    readonly sample_rate?: string;
  }[];
  readonly format?: { readonly duration?: string };
}

function runFfprobeJson(file: string): ProbeJson | null {
  const result = capture(
    ffprobePath(),
    ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file],
    undefined,
  );
  if (result.status !== 0 || result.stdout.trim().length === 0) return null;
  try {
    return JSON.parse(result.stdout) as ProbeJson;
  } catch {
    return null;
  }
}

export interface MediaProbe {
  readonly path: string;
  /**
   * Duração do **contêiner** (o que um player vê como duração do arquivo).
   *
   * Atenção medida nesta sessão: em MP4 com AAC, a duração do contêiner é a da **maior** trilha, e o
   * codificador de áudio arredonda para o quadro AAC seguinte mais o atraso de inicialização. Um vídeo de
   * 811 quadros (27,033333 s) sai com contêiner de 27,100000 s. Comparar o contêiner com a timeline daria
   * falso positivo de 67 ms — por isso `videoDurationMs` existe e é ele que confere o vídeo.
   */
  readonly durationMs: number;
  /** Duração da trilha de vídeo. Pode ser menor que `durationMs` por causa do padding do AAC. */
  readonly videoDurationMs: number | null;
  readonly audioDurationMs: number | null;
  readonly width: number | null;
  readonly height: number | null;
  readonly fps: number | null;
  readonly frames: number | null;
  readonly hasAudio: boolean;
}

function streamSecondsMs(stream: { readonly duration?: string } | undefined): number | null {
  const seconds = Number.parseFloat(stream?.duration ?? '');
  return Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds * 1000) : null;
}

/** Converte `"30/1"` (formato do ffprobe) em número. */
export function parseFrameRate(value: string | undefined): number | null {
  if (!value) return null;
  const [num, den] = value.split('/');
  const n = Number.parseFloat(num ?? '');
  const d = den === undefined ? 1 : Number.parseFloat(den);
  if (!Number.isFinite(n) || !Number.isFinite(d) || d === 0) return null;
  return n / d;
}

/**
 * Mede o arquivo de verdade.
 *
 * É a única fonte de duração aceita no pipeline: nem a duração que pedimos ao provedor, nem `tempo_min`
 * do livro de custos. Duração de mentira contamina timeline, legenda e custo por minuto de uma vez só.
 */
export function probeMedia(file: string): MediaProbe {
  assertFfmpegAvailable();
  const json = runFfprobeJson(file);
  if (json === null) {
    throw new FfmpegError('ffmpeg-falhou', `Não foi possível ler "${file}" com o ffprobe (arquivo ausente ou inválido).`);
  }

  const streams = json.streams ?? [];
  const video = streams.find((stream) => stream.codec_type === 'video');
  const audio = streams.find((stream) => stream.codec_type === 'audio');
  const seconds = Number.parseFloat(json.format?.duration ?? '');
  if (!Number.isFinite(seconds) || seconds <= 0) {
    throw new FfmpegError('ffmpeg-falhou', `O ffprobe não informou duração para "${file}". Sem duração não há timeline.`);
  }

  const fps = parseFrameRate(video?.r_frame_rate) ?? parseFrameRate(video?.avg_frame_rate);
  const declaredFrames = video?.nb_frames === undefined ? Number.NaN : Number.parseInt(video.nb_frames, 10);
  const frames = Number.isFinite(declaredFrames)
    ? declaredFrames
    : video && fps
      ? Math.round(seconds * fps)
      : null;

  const fromStream = streamSecondsMs(video);
  const videoDurationMs =
    fromStream ?? (frames !== null && fps !== null && fps > 0 ? Math.round((frames / fps) * 1000) : null);

  return {
    path: file,
    durationMs: Math.round(seconds * 1000),
    videoDurationMs,
    audioDurationMs: streamSecondsMs(audio),
    width: video?.width ?? null,
    height: video?.height ?? null,
    fps,
    frames,
    hasAudio: audio !== undefined,
  };
}

/** Duração medida de um arquivo de áudio/imagem — o TTS é a fonte da verdade da timeline. */
export function probeDurationMs(file: string): number {
  return probeMedia(file).durationMs;
}

export interface LoudnessMeasurement {
  readonly integratedLufs: number;
  readonly truePeakDb: number;
  readonly lra: number;
}

/**
 * Mede o loudness integrado do arquivo já renderizado.
 *
 * O resumo do `loudnorm` sai no **stderr** do ffmpeg (não no stdout) — capturar o canal errado devolve
 * string vazia e um relatório que diz "medido" sem ter medido nada. E o log tem de ser o **completo**: o
 * resumo fica no meio da saída, então truncar as últimas linhas apaga justamente o que se quer medir.
 *
 * Devolve `null` quando não dá para medir (sem áudio, log fora do formato). `null` é honesto; `0` seria
 * um número inventado sobre qualidade de áudio.
 */
export function measureLoudness(file: string): LoudnessMeasurement | null {
  const run = runFfmpeg(['-hide_banner', '-nostats', '-i', file, '-af', 'loudnorm=print_format=summary', '-f', 'null', '-']);
  return parseLoudnessSummary(run.fullLog);
}

/**
 * Análise de loudness (passe 1 de 2) para o `loudnorm` linear.
 *
 * Serve para o render **atingir** o alvo declarado em vez de chegar perto: no modo passe único o filtro
 * trabalha dinamicamente, sem saber o que vem depois, e num material de 27 s ele parou ~6 LU abaixo do
 * alvo (medido: −20,1 LUFS com `I=-14`). O passe 1 mede; o passe 2 aplica ganho linear com os números
 * medidos. Sem isso, "aplicamos loudnorm" seria verdade e "o áudio está no alvo" seria falso.
 *
 * Devolve `null` quando o resumo não vem no formato esperado — e aí o render cai para passe único e diz
 * isso, em vez de aplicar números inventados.
 */
export interface LoudnormAnalysis {
  readonly inputIntegratedLufs: number;
  readonly inputTruePeakDb: number;
  readonly inputLra: number;
  readonly inputThresholdLufs: number;
  readonly targetOffsetLu: number;
}

export function analyzeLoudness(
  file: string,
  target: { readonly integratedLufs: number; readonly truePeakDb: number; readonly lra: number },
): LoudnormAnalysis | null {
  const run = runFfmpeg([
    '-hide_banner',
    '-nostats',
    '-i',
    file,
    '-af',
    `loudnorm=I=${target.integratedLufs}:TP=${target.truePeakDb}:LRA=${target.lra}:print_format=summary`,
    '-f',
    'null',
    '-',
  ]);
  return parseLoudnormAnalysis(run.fullLog);
}

/** Exportado para teste: o formato do resumo é contrato com o ffmpeg, não detalhe interno. */
export function parseLoudnormAnalysis(log: string): LoudnormAnalysis | null {
  const value = (pattern: RegExp): number | null => {
    const match = pattern.exec(log);
    if (match?.[1] === undefined) return null;
    const parsed = Number.parseFloat(match[1]);
    return Number.isFinite(parsed) ? parsed : null;
  };

  // `[+-]?` e não `-?`: o ffmpeg imprime sinal explícito em algumas linhas (`Target Offset:  +0.0 LU`), e
  // sem aceitar o `+` a leitura inteira falhava e o render caía para passe único em silêncio — defeito
  // medido nesta sessão, com o resumo na tela e o relatório dizendo "não reconhecido".
  const inputIntegratedLufs = value(/Input Integrated:\s*([+-]?\d+(?:\.\d+)?)\s*LUFS/i);
  const inputTruePeakDb = value(/Input True Peak:\s*([+-]?\d+(?:\.\d+)?)\s*dBTP/i);
  // Atenção ao sufixo: o LRA é medido em **LU**, não em LUFS. Exigir "LUFS" aqui fazia a leitura falhar.
  const inputLra = value(/Input LRA:\s*([+-]?\d+(?:\.\d+)?)\s*LU/i);
  const inputThresholdLufs = value(/Input Threshold:\s*([+-]?\d+(?:\.\d+)?)\s*LUFS/i);
  const targetOffsetLu = value(/Target Offset:\s*([+-]?\d+(?:\.\d+)?)\s*LU/i);

  if (
    inputIntegratedLufs === null ||
    inputTruePeakDb === null ||
    inputLra === null ||
    inputThresholdLufs === null ||
    targetOffsetLu === null
  ) {
    return null;
  }

  return { inputIntegratedLufs, inputTruePeakDb, inputLra, inputThresholdLufs, targetOffsetLu };
}

/** Exportado para teste: o formato do resumo é contrato com o ffmpeg, não detalhe interno. */
export function parseLoudnessSummary(log: string): LoudnessMeasurement | null {
  const analysis = parseLoudnormAnalysis(log);
  if (analysis === null) return null;
  return {
    integratedLufs: analysis.inputIntegratedLufs,
    truePeakDb: analysis.inputTruePeakDb,
    lra: analysis.inputLra,
  };
}
