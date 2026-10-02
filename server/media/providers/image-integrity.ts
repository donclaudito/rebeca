/**
 * Integridade do ativo de imagem — **uma** implementação para todos os adapters que gravam arte.
 *
 * ## Por que este arquivo existe (achado 3 do `QA-016`, e a razão de processo por trás dele)
 *
 * A validação de "o arquivo que o provedor mandou é uma imagem de verdade" nasceu dentro de `minimax.ts`
 * e ficou lá. O `QA-016` então mediu o que isso produziu: o adapter da **OpenAI** — que é o caminho pago
 * de thumbnail **em uso** (`providerForThumbnails` prefere a OpenAI quando há chave, e o livro já tinha
 * 13 linhas `openai` de thumbnail) — continuou com o defeito do `QA-015` **verbatim**: gravava antes de
 * validar e tratava `existsSync` como "ativo pronto". Um arquivo de **zero byte** com o nome certo virava
 * arte aprovada para reuso, e a retentativa devolvia sucesso com custo zero.
 *
 * Duplicar a regra foi o que criou o achado: duas funções, dois comportamentos. Aqui há **uma**
 * implementação, e quem muda de comportamento é só quem não a usa.
 *
 * ## As duas camadas, e por que a primeira **não** pode depender de binário
 *
 * 1. **Estrutura, em JS puro (sempre).** PNG: assinatura completa, caminhada pelos *chunks* com
 *    conferência de **CRC**, `IHDR` com campos válidos (dimensão, `colorType`, `bitDepth`, compressão,
 *    filtro, `interlace` ∈ {0,1}), presença de `IDAT` + `IEND`, `IDAT` que **infla de verdade** (`zlib`) e
 *    pixels suficientes para as dimensões declaradas. JPEG: começo (`FFD8`), fim (`FFD9`) e caminhada de
 *    segmentos até o `SOS`.
 * 2. **Decodificação real pelo ffmpeg (quando o binário existe).** `-frames:v 1 -f null -` prova que o
 *    mesmo decodificador que monta o clipe consegue abrir o arquivo.
 *
 * A camada 1 existe porque a camada 2 **não pode ser exigida em todo ambiente**: a rota de thumbnail
 * (`/api/media/thumbnails`) roda em request e pode rodar em ambiente sem ffmpeg (a Vercel é citada em
 * `server/ai/ledger.ts`). O **piso é igual em qualquer máquina**; o teto é mais alto onde o pipeline de
 * vídeo roda — que é onde o arquivo vai ser consumido.
 *
 * ## O que foi medido, e por que **não** é `ffprobe`
 *
 * `ffprobe` sai com **exit 0** para um PNG truncado (relata `width: 0, height: 0`) e até para uma página
 * HTML de erro com nome `.png` — o demuxer `image2` adivinha pelo nome do arquivo. Medido nesta sessão,
 * ffmpeg 8.1.2: `ffmpeg -frames:v 1 -f null -` recusa os três casos em **0,05 s** (não trava).
 *
 * ## O tipo do erro é do adapter, não deste módulo
 *
 * `createImageIntegrity` recebe a fábrica de erro. Assim cada adapter mantém a **própria** classe e o
 * próprio `code` (`MiniMaxError('resposta-invalida')`, `OpenAiImageError('resposta-invalida')`) — o que
 * garante que extrair isto para cá não muda nada do que já era observável no caminho da MiniMax.
 */

import { readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { ensureParentDir } from '../paths.js';
import { ffmpegAvailable, runFfmpeg } from '../ffmpeg.js';

/** Fábrica do erro do adapter: recebe a mensagem pronta e devolve a exceção dele. */
export type ImageErrorFactory = (mensagem: string) => Error;

/**
 * Formatos aceitos.
 *
 * - `'png-ou-jpeg'`: o que a MiniMax pode devolver em `base64` (o formato não é documentado).
 * - `'png'`: o que a OpenAI declara (`b64_json` do `gpt-image`) — e o ativo nasce com extensão `.png`, então
 *   aceitar JPEG ali seria aceitar um arquivo que o manifesto chama de PNG.
 */
export type ImageFormats = 'png' | 'png-ou-jpeg';

export interface ImageIntegrityOptions {
  readonly criarErro: ImageErrorFactory;
  readonly formatos: ImageFormats;
}

export interface ImageIntegrity {
  /** O arquivo é uma imagem **inteira e decodificável**? Lança pelo `criarErro` do adapter quando não é. */
  assertDecodableImage(path: string, contexto: string): void;
  /** Dá para **reusar** o que está em `path`? Arquivo envenenado não conta como ativo pronto. */
  isUsableImage(path: string): boolean;
  /** Grava **só depois de validar**, promovendo por `rename` — atômico. */
  writeValidatedImage(path: string, bytes: Buffer, contexto: string): void;
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_SIGNATURE = Buffer.from([0xff, 0xd8, 0xff]);

type Estrutura = { readonly ok: true } | { readonly ok: false; readonly motivo: string };

/** Canais por pixel de cada `colorType` do PNG (0=cinza, 2=RGB, 3=paleta, 4=cinza+alfa, 6=RGBA). */
const PNG_CANAIS: Readonly<Record<number, number>> = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

/** Profundidades de bit que o formato admite por `colorType`. */
function profundidadesValidas(colorType: number): readonly number[] {
  if (colorType === 3) return [1, 2, 4, 8];
  if (colorType === 0) return [1, 2, 4, 8, 16];
  return [8, 16];
}

interface PngCabecalho {
  readonly largura: number;
  readonly altura: number;
  readonly bitDepth: number;
  readonly colorType: number;
  readonly entrelace: number;
}

/** Tabela do CRC-32 do PNG (polinômio 0xEDB88320), montada uma vez. */
let crcTable: Uint32Array | null = null;

function crc32(bytes: Buffer): number {
  if (crcTable === null) {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = (c & 1) === 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
    crcTable = table;
  }
  let c = 0xffffffff;
  for (const byte of bytes) c = (crcTable[(c ^ byte) & 0xff] ?? 0) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/**
 * O `IHDR` declara uma imagem possível? (achados novos do `QA-016`, gravidade MÉDIA e BAIXA)
 *
 * A primeira versão da camada 1 só conferia que o `IHDR` tinha 13 bytes. O QA mediu o que passava por
 * isso: `IHDR 0x0`, `colorType=99`, `bitDepth=7` e `interlace=7` — o formato define **0 e 1** de
 * entrelace — todos aceitos pela camada 1 e recusados só pelo ffmpeg; e o `interlace` inválido passava
 * pelas **duas** camadas, virando o ativo do canal.
 *
 * Isso importa para além do caso exótico: a camada 2 é **condicional** (`if (ffmpegAvailable())`), porque
 * a rota de thumbnail roda em ambiente que pode não ter o binário. Onde ele não existe, a camada 1 é a
 * única defesa — e ela estava aceitando cabeçalho que o formato não define.
 */
function ihdrValido(dados: Buffer): Estrutura & { readonly cabecalho?: PngCabecalho } {
  if (dados.length !== 13) return { ok: false, motivo: 'o IHDR não tem os 13 bytes do formato' };

  const cabecalho: PngCabecalho = {
    largura: dados.readUInt32BE(0),
    altura: dados.readUInt32BE(4),
    bitDepth: dados[8] ?? 0,
    colorType: dados[9] ?? 0,
    entrelace: dados[12] ?? 0,
  };
  const compressao = dados[10] ?? 0;
  const filtro = dados[11] ?? 0;

  if (cabecalho.largura === 0 || cabecalho.altura === 0) {
    return { ok: false, motivo: 'o IHDR declara dimensão zero (não há imagem)' };
  }
  if (PNG_CANAIS[cabecalho.colorType] === undefined) {
    return { ok: false, motivo: `o IHDR declara colorType ${cabecalho.colorType}, que o formato não define` };
  }
  if (!profundidadesValidas(cabecalho.colorType).includes(cabecalho.bitDepth)) {
    return {
      ok: false,
      motivo: `o IHDR declara bitDepth ${cabecalho.bitDepth}, inválido para o colorType ${cabecalho.colorType}`,
    };
  }
  if (compressao !== 0 || filtro !== 0) {
    return { ok: false, motivo: 'o IHDR usa método de compressão/filtro que o formato não define' };
  }
  if (cabecalho.entrelace !== 0 && cabecalho.entrelace !== 1) {
    return { ok: false, motivo: `o IHDR declara interlace ${cabecalho.entrelace}, e o formato define só 0 e 1` };
  }
  return { ok: true, cabecalho };
}

/**
 * O PNG está inteiro? Caminha os *chunks*, **valida o IHDR**, infla o `IDAT` e confere que os pixels
 * descomprimidos bastam para as dimensões declaradas.
 *
 * Os `IDAT` são concatenados antes de inflar porque o formato permite vários; inflar cada um sozinho
 * recusaria PNGs legítimos multi-`IDAT` (e recusar arte boa é pior que o defeito que isto corrige).
 *
 * A conferência de tamanho só vale para PNG **não entrelaçado**: no Adam7 (`interlace=1`) a disposição
 * dos pixels é outra, e usar a fórmula linear aqui recusaria imagens válidas. Onde não dá para afirmar,
 * este código **não afirma** — a imagem entrelaçada segue para a camada 2, que a decodifica.
 */
function pngInteiro(bytes: Buffer): Estrutura {
  let offset = PNG_SIGNATURE.length;
  let cabecalho: PngCabecalho | null = null;
  let temIend = false;
  const partesIdat: Buffer[] = [];

  while (offset + 8 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const tipo = bytes.subarray(offset + 4, offset + 8).toString('latin1');
    const fimDados = offset + 8 + length;
    if (fimDados + 4 > bytes.length) {
      return { ok: false, motivo: `o chunk "${tipo}" declara ${length} bytes e o arquivo acaba antes` };
    }
    const dados = bytes.subarray(offset + 8, fimDados);
    const crcNoArquivo = bytes.readUInt32BE(fimDados);
    if (crc32(Buffer.concat([Buffer.from(tipo, 'latin1'), dados])) !== crcNoArquivo) {
      return { ok: false, motivo: `o CRC do chunk "${tipo}" não confere (conteúdo corrompido)` };
    }

    if (tipo === 'IHDR') {
      const validado = ihdrValido(dados);
      if (!validado.ok) return validado;
      cabecalho = validado.cabecalho ?? null;
    } else if (tipo === 'IDAT') {
      partesIdat.push(dados);
    } else if (tipo === 'IEND') {
      temIend = true;
      break;
    }
    offset = fimDados + 4;
  }

  if (cabecalho === null) return { ok: false, motivo: 'não há IHDR (cabeçalho de imagem)' };
  if (partesIdat.length === 0) return { ok: false, motivo: 'não há IDAT: o arquivo não tem um pixel' };
  if (!temIend) return { ok: false, motivo: 'não há IEND: o arquivo foi cortado no meio' };

  let pixels: Buffer;
  try {
    pixels = inflateSync(Buffer.concat(partesIdat));
  } catch (error) {
    return { ok: false, motivo: `o IDAT não descomprime (${error instanceof Error ? error.message : String(error)})` };
  }

  if (cabecalho.entrelace === 0) {
    const canais = PNG_CANAIS[cabecalho.colorType] ?? 1;
    const bytesPorLinha = 1 + Math.ceil((cabecalho.largura * canais * cabecalho.bitDepth) / 8);
    const esperado = bytesPorLinha * cabecalho.altura;
    // `<` e não `!==`: bytes a mais são inofensivos para quem decodifica, e recusar arte boa é o pior
    // erro possível aqui. O que não pode é FALTAR pixel — e era exatamente esse o caso que passava.
    if (pixels.length < esperado) {
      return {
        ok: false,
        motivo:
          `o IDAT descomprime para ${pixels.length} bytes e o IHDR (${cabecalho.largura}x${cabecalho.altura}, ` +
          `colorType ${cabecalho.colorType}, ${cabecalho.bitDepth} bits) exige ${esperado}`,
      };
    }
  }

  return { ok: true };
}

/**
 * O JPEG tem começo, varredura e fim?
 *
 * Mais fraco que o do PNG, e o código diz isso: sem decodificar não há como provar que a imagem inteira
 * está lá. Ainda assim pega o que interessa — arquivo cortado, cabeçalho inválido e segmento truncado.
 */
function jpegInteiro(bytes: Buffer): Estrutura {
  if (bytes.length < 4 || bytes.readUInt16BE(bytes.length - 2) !== 0xffd9) {
    return { ok: false, motivo: 'não termina em FFD9 (marcador de fim do JPEG): o arquivo foi cortado' };
  }
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) return { ok: false, motivo: `segmento JPEG inválido no byte ${offset}` };
    const marcador = bytes[offset + 1] ?? 0;
    if (marcador === 0xda) return { ok: true }; // SOS: o resto é o fluxo comprimido, até o EOI conferido acima
    const tamanho = bytes.readUInt16BE(offset + 2);
    if (tamanho < 2 || offset + 2 + tamanho > bytes.length) {
      return { ok: false, motivo: `segmento JPEG truncado no byte ${offset}` };
    }
    offset += 2 + tamanho;
  }
  return { ok: false, motivo: 'não foi encontrado o marcador SOS (início da varredura)' };
}

export function createImageIntegrity(options: ImageIntegrityOptions): ImageIntegrity {
  const { criarErro, formatos } = options;

  function mensagemSemAssinatura(path: string, contexto: string): string {
    return formatos === 'png'
      ? `O arquivo gravado em "${path}" (${contexto}) não é um PNG: a assinatura de 8 bytes não confere. ` +
          'Melhor falhar aqui do que entregar um arquivo corrompido ao humano.'
      : `O arquivo gravado em "${path}" (${contexto}) não é uma imagem: a assinatura PNG (8 bytes) ou JPEG ` +
          '(3 bytes) não confere. Melhor falhar aqui do que entregar um arquivo corrompido ao humano.';
  }

  function assertDecodableImage(path: string, contexto: string): void {
    const bytes = readFileSync(path);
    const isPng =
      bytes.length >= PNG_SIGNATURE.length && bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE);
    const isJpeg =
      formatos === 'png-ou-jpeg' &&
      bytes.length >= JPEG_SIGNATURE.length &&
      bytes.subarray(0, JPEG_SIGNATURE.length).equals(JPEG_SIGNATURE);

    if (!isPng && !isJpeg) throw criarErro(mensagemSemAssinatura(path, contexto));

    const estrutura = isPng ? pngInteiro(bytes) : jpegInteiro(bytes);
    if (!estrutura.ok) {
      throw criarErro(
        `O arquivo gravado em "${path}" (${contexto}) tem assinatura de imagem mas está incompleto: ` +
          `${estrutura.motivo}. É arquivo truncado ou corrompido, e o passo do clipe travaria (ou falharia) ` +
          'sobre ele. Nada foi promovido ao destino.',
      );
    }

    // Camada 2: só onde o ffmpeg existe. É o mesmo decodificador que vai montar o clipe.
    if (ffmpegAvailable()) {
      const run = runFfmpeg(['-v', 'error', '-i', path, '-frames:v', '1', '-f', 'null', '-']);
      if (!run.ok) {
        throw criarErro(
          `O arquivo gravado em "${path}" (${contexto}) passou na conferência estrutural mas o ffmpeg NÃO ` +
            `conseguiu decodificá-lo. Log: ${run.log}`,
        );
      }
    }
  }

  /**
   * Dá para **reusar** o que está em `path`?
   *
   * O que isto substitui, nos dois adapters que usavam a forma antiga: `existsSync(path)` e
   * `readFileSync(path).length > 0`. Arquivo envenenado (lixo do provedor, PNG truncado por processo
   * morto, arquivo de **zero byte**) contava como ativo pronto — e a retentativa devolvia "sucesso com
   * custo zero" sobre ele, transformando uma falha detectada em sucesso silencioso (achado 1 do
   * `QA-015`, que sobreviveu no adapter da OpenAI até o `QA-016`). Reusar só vale quando o arquivo
   * continua sendo o que ele deveria ser.
   */
  function isUsableImage(path: string): boolean {
    try {
      if (readFileSync(path).length === 0) return false;
    } catch {
      return false;
    }
    try {
      assertDecodableImage(path, 'verificação de reuso');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Grava os bytes **só depois de validar**, e promove por `rename` — atômico.
   *
   * A ordem antiga era `writeFileSync` → conferir assinatura: quando a validação falhava, o arquivo ruim
   * **ficava no disco** e a execução seguinte o tratava como ativo pronto. Aqui os bytes vão para um
   * arquivo de passagem ao lado (`<path>.parcial`), são validados lá mesmo e só então promovidos;
   * qualquer falha apaga o parcial e deixa o destino **inexistente** — que é a verdade: não há ativo.
   *
   * O parcial nasce na mesma pasta do destino (já validada contra o escopo do canal) e o `rename` dentro
   * do mesmo volume é atômico: não existe janela em que o destino tenha conteúdo pela metade.
   */
  function writeValidatedImage(path: string, bytes: Buffer, contexto: string): void {
    const parcial = `${path}.parcial`;
    ensureParentDir(path);
    writeFileSync(parcial, bytes);
    try {
      assertDecodableImage(parcial, contexto);
    } catch (error) {
      rmSync(parcial, { force: true });
      throw error;
    }
    renameSync(parcial, path);
  }

  return { assertDecodableImage, isUsableImage, writeValidatedImage };
}
