/**
 * Composição **local** da arte de thumbnail — sem provedor, sem chave, sem rede, custo zero.
 *
 * Por que existe: o dono do produto não conseguiu a chave da MiniMax e pediu a alternativa gratuita.
 * O caminho local já existia, mas desenhava "texto sobre fundo chapado" — o próprio app dizia que
 * aquilo não era arte publicável. Esta composição faz o que dá para fazer **sem personagem e sem
 * contrato**: fundo em gradiente, faixa de arco-íris (o tema do canal), painel claro com o título em
 * corpo grande e a hipótese da opção em corpo pequeno. É um thumbnail de verdade para canal infantil;
 * o que continua faltando é a **Luna ilustrada**, e isso depende do Character Sheet (`rebeca-branding`).
 *
 * Três decisões que valem explicação:
 *
 * 1. **Texto é quebrado em linhas aqui, antes de virar filtro.** A primeira versão desta composição foi
 *    conferida a olho e **transbordou o quadro**: "SETE CORES" saiu como "CO RES", cortado nas duas
 *    bordas, e a linha da hipótese vazou do painel. Filtro de ffmpeg não quebra linha sozinho — quem
 *    não quebra antes desenha fora do quadro, sem erro nenhum no log.
 * 2. **O layout é calculado, não chutado.** A altura do título decide onde a hipótese começa; o painel
 *    é dimensionado para os dois. Posição fixa com texto variável é o mesmo defeito por outro caminho.
 * 3. **O fundo muda por opção.** As quatro opções testam hipóteses diferentes; fundo idêntico faria
 *    quatro variações da mesma aposta. O `seed` escolhe o par de cores.
 *
 * Este módulo é **puro**: monta a lista de filtros e devolve as linhas já quebradas. Quem escreve os
 * arquivos de texto e chama o ffmpeg é o provedor — assim a composição é testável sem ffmpeg.
 */

/** Fundos por opção (par `c0`→`c1` do filtro `gradients`). Suaves e claros: público de 3 a 6 anos. */
const FUNDOS: readonly (readonly [string, string])[] = [
  ['0xFFF3D6', '0xBFE3FF'],
  ['0xFFE3EF', '0xD9F7E8'],
  ['0xE8F0FE', '0xFFF0DB'],
  ['0xF3E8FF', '0xDDF7FF'],
];

/** Arco-íris do rodapé — o motivo do canal ("Luna e o Jardim das Cores"). */
const ARCO_IRIS: readonly string[] = [
  '0xFF5A5F',
  '0xFFA552',
  '0xFFD166',
  '0x8AC926',
  '0x4CC9F0',
  '0x4361EE',
  '0x9B5DE5',
];

const BARRA_PX = 9;
const PAINEL_MARGEM_X = 48;
/** Altura do painel claro que dá contraste ao texto (o texto é centrado em `h/2`). */
const PAINEL_ALTURA = 330;
const TITULO_TAMANHO = 104;
const HIPOTESE_TAMANHO = 26;
const TITULO_MAX_CARACTERES = 12;
const HIPOTESE_MAX_CARACTERES = 58;

export interface LocalThumbnailLayout {
  readonly width: number;
  readonly height: number;
  /** Texto que entra na arte — curto (3 a 4 palavras), como manda o contrato. */
  readonly textOnImage: string;
  /** Qual hipótese esta opção testa. Vai na arte em corpo pequeno, para comparar as quatro. */
  readonly hypothesis: string;
  /** Nome do canal, quando quem chama tem o dado. Sem ele, a linha do rodapé de marca não é desenhada. */
  readonly channelName?: string;
  readonly seed: number;
}

export interface LocalThumbnailPaths {
  /** Já escapado por `escapeFilterOptionValue` — o escape é responsabilidade de quem conhece o ffmpeg. */
  readonly font: string;
  readonly titleFile: string;
  readonly hypothesisFile: string;
  /** Só é usado quando há `channelName` no layout. */
  readonly channelFile?: string;
}

/** Quebra por palavras. Linha que passa de `max` desce — nada é cortado nem sai do quadro. */
export function wrapForThumbnail(text: string, max: number): string[] {
  const palavras = String(text)
    .split(/\s+/)
    .filter((palavra) => palavra.length > 0);
  if (palavras.length === 0) return [''];

  const linhas: string[] = [];
  let atual = '';
  for (const palavra of palavras) {
    const candidata = atual.length > 0 ? `${atual} ${palavra}` : palavra;
    if (candidata.length > max && atual.length > 0) {
      linhas.push(atual);
      atual = palavra;
    } else {
      atual = candidata;
    }
  }
  linhas.push(atual);
  return linhas;
}

/** O par de cores do fundo para esta opção. */
export function thumbnailPalette(seed: number): readonly [string, string] {
  const indice = Math.abs(Math.trunc(seed)) % FUNDOS.length;
  return FUNDOS[indice] ?? FUNDOS[0]!;
}

/**
 * Os textos **já quebrados** que vão para os arquivos lidos pelo `drawtext`.
 *
 * Existe para que quem escreve os arquivos use exatamente as mesmas linhas que a composição mediu —
 * quebrar em dois lugares diferentes é como o título voltaria a transbordar o quadro.
 */
export function thumbnailTexts(layout: LocalThumbnailLayout): { title: string; hypothesis: string } {
  return {
    title: wrapForThumbnail(layout.textOnImage.toUpperCase(), TITULO_MAX_CARACTERES).join('\n'),
    hypothesis: wrapForThumbnail(`(${layout.hypothesis})`, HIPOTESE_MAX_CARACTERES).join('\n'),
  };
}

/**
 * Fundo + moldura: a camada **visual** por baixo do texto.
 *
 * Existe separada porque o texto é responsabilidade de quem calcula o corpo da fonte (o provedor), e a
 * identidade visual é desta composição. As faixas do arco-íris vêm **antes** do painel: desenhadas
 * depois, ficariam atrás dele.
 */
export function buildBackdropFilters(layout: LocalThumbnailLayout): string[] {
  const filters: string[] = [];
  ARCO_IRIS.forEach((cor, indice) => {
    const y = layout.height - indice * BARRA_PX - BARRA_PX;
    filters.push(`drawbox=x=0:y=${y}:w=iw:h=${BARRA_PX}:color=${cor}:t=fill`);
  });
  const painelY = Math.round(layout.height / 2 - PAINEL_ALTURA / 2);
  filters.push(
    `drawbox=x=${PAINEL_MARGEM_X}:y=${painelY}:w=iw-${PAINEL_MARGEM_X * 2}:h=${PAINEL_ALTURA}:color=white@0.93:t=fill`,
  );
  return filters;
}

/**
 * A cadeia de filtros do ffmpeg, na ordem em que importa:
 * faixas do arco-íris (rodapé) → painel claro → título → hipótese → nome do canal e a nota de
 * procedência. As faixas vêm **antes** do painel de propósito: desenhadas depois, ficariam atrás dele.
 */
export function buildThumbnailFilters(
  layout: LocalThumbnailLayout,
  paths: LocalThumbnailPaths,
): { filters: string[]; titleLines: string[]; hypothesisLines: string[] } {
  const titleLines = wrapForThumbnail(layout.textOnImage.toUpperCase(), TITULO_MAX_CARACTERES);
  const hypothesisLines = wrapForThumbnail(`(${layout.hypothesis})`, HIPOTESE_MAX_CARACTERES);

  const filters: string[] = buildBackdropFilters(layout);

  filters.push(
    `drawtext=fontfile=${paths.font}:textfile=${paths.titleFile}:expansion=none:fontcolor=0x111827:fontsize=${TITULO_TAMANHO}:line_spacing=6:x=(w-text_w)/2:y=${Math.round(layout.height / 2 - PAINEL_ALTURA / 2) + 26}`,
  );

  // Onde a hipótese começa depende de quantas linhas o título ocupou — posição fixa vazaria do painel.
  const alturaTitulo = titleLines.length * (TITULO_TAMANHO + 6);
  filters.push(
    `drawtext=fontfile=${paths.font}:textfile=${paths.hypothesisFile}:expansion=none:fontcolor=0x475569:fontsize=${HIPOTESE_TAMANHO}:line_spacing=10:x=(w-text_w)/2:y=${Math.round(layout.height / 2 - PAINEL_ALTURA / 2) + 26 + alturaTitulo + 18}`,
  );

  if (layout.channelName !== undefined && layout.channelName.length > 0 && paths.channelFile !== undefined) {
    filters.push(
      `drawtext=fontfile=${paths.font}:textfile=${paths.channelFile}:expansion=none:fontcolor=0x475569:fontsize=30:x=56:y=40`,
    );
  }
  // Nota de procedência: a arte é local e **não** tem o personagem. Sem isso, um PNG bonito de título
  // passaria por arte final da Luna — e ninguém saberia que falta o Character Sheet.
  filters.push(
    `drawtext=fontfile=${paths.font}:text='arte local · sem personagem':expansion=none:fontcolor=0x94A3B8:fontsize=22:x=56:y=${layout.channelName ? 82 : 40}`,
  );

  return { filters, titleLines, hypothesisLines };
}

/** O gradiente do fundo, como entrada `lavfi`. */
export function buildThumbnailBackground(layout: LocalThumbnailLayout): string {
  const [from, to] = thumbnailPalette(layout.seed);
  return `gradients=s=${layout.width}x${layout.height}:c0=${from}:c1=${to}`;
}
