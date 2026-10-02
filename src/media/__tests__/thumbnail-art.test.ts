/**
 * Arte local de thumbnail — a alternativa **gratuita** ao provedor pago.
 *
 * Contexto: o dono do produto não conseguiu a chave da MiniMax e pediu a opção gratuita ou a mais
 * barata. A mais barata de todas é não chamar provedor nenhum: o ffmpeg desta máquina compõe a arte
 * (custo zero, sem chave, sem contrato). O que se prova aqui é o que dá para provar **sem ffmpeg**:
 * a geometria e o texto que a composição entrega.
 *
 * O defeito que originou o primeiro caso foi encontrado **olhando a imagem**, não lendo o código: a
 * primeira versão não quebrava linha, e "SETE CORES" saiu como "CO RES", cortado nas duas bordas, com
 * a linha da hipótese vazando do painel — o ffmpeg não reclama, só desenha fora do quadro.
 */

import { describe, expect, it } from 'vitest';
import {
  buildBackdropFilters,
  buildThumbnailBackground,
  buildThumbnailFilters,
  thumbnailPalette,
  thumbnailTexts,
  wrapForThumbnail,
} from '../../../server/media/thumbnail-art.js';
import type { LocalThumbnailLayout, LocalThumbnailPaths } from '../../../server/media/thumbnail-art.js';

const LAYOUT: LocalThumbnailLayout = {
  width: 1280,
  height: 720,
  textOnImage: 'Sete cores do arco-íris',
  hypothesis: 'a · foco no objeto: o arco-íris inteiro',
  seed: 0,
};

const PATHS: LocalThumbnailPaths = {
  font: 'C\\\\:/Windows/Fonts/arialbd.ttf',
  titleFile: 'C\\\\:/tmp/titulo.txt',
  hypothesisFile: 'C\\\\:/tmp/hipotese.txt',
};

describe('arte local de thumbnail', () => {
  it('quebra o texto em linhas — sem isso o título transborda o quadro', () => {
    const linhas = wrapForThumbnail('Sete cores do arco-íris inteiro', 12);

    expect(linhas.length).toBeGreaterThan(1);
    for (const linha of linhas) {
      expect(linha.length, `linha "${linha}" passou do limite`).toBeLessThanOrEqual(12);
    }
    // Nenhuma palavra pode sumir na quebra — texto cortado é o defeito original.
    expect(linhas.join(' ')).toBe('Sete cores do arco-íris inteiro');
  });

  it('o texto quebrado é exatamente o que vai para o arquivo lido pelo drawtext', () => {
    const textos = thumbnailTexts(LAYOUT);

    expect(textos.title).toContain('\n');
    for (const linha of textos.title.split('\n')) expect(linha).toBe(linha.toUpperCase());
    expect(textos.title.replace(/\n/g, ' ')).toBe('SETE CORES DO ARCO-ÍRIS');
    expect(textos.hypothesis.startsWith('(a · foco no objeto')).toBe(true);
  });

  it('a camada visual vem antes do texto: 7 faixas do arco-íris e depois o painel claro', () => {
    const fundo = buildBackdropFilters(LAYOUT);

    const barras = fundo.filter((filtro) => filtro.includes('color=0x') && filtro.includes('drawbox'));
    expect(barras.length).toBe(7);
    const painel = fundo.findIndex((filtro) => filtro.includes('color=white@0.93'));
    expect(painel).toBe(7);
    // O painel precisa cobrir a faixa onde o texto é centrado (h/2).
    const y = Number(/y=(\d+)/.exec(fundo[7] ?? '')?.[1] ?? '-1');
    const altura = Number(/h=(\d+)/.exec(fundo[7] ?? '')?.[1] ?? '-1');
    expect(y).toBeLessThan(LAYOUT.height / 2);
    expect(y + altura).toBeGreaterThan(LAYOUT.height / 2);
  });

  it('o fundo muda por opção — quatro fundos iguais seriam a mesma aposta repetida', () => {
    expect(thumbnailPalette(0)).not.toEqual(thumbnailPalette(1));
    expect(thumbnailPalette(4)).toEqual(thumbnailPalette(0));

    const fundo0 = buildThumbnailBackground({ ...LAYOUT, seed: 0 });
    const fundo1 = buildThumbnailBackground({ ...LAYOUT, seed: 1 });
    expect(fundo0).not.toBe(fundo1);
    expect(fundo0).toContain('gradients=s=1280x720');
  });

  it('a arte carrega a nota de procedência e não inventa nome de canal', () => {
    const semCanal = buildThumbnailFilters(LAYOUT, PATHS).filters.join(',');
    expect(semCanal).toContain('arte local · sem personagem');

    const comCanal = buildThumbnailFilters({ ...LAYOUT, channelName: 'Luna e o Jardim das Cores' }, {
      ...PATHS,
      channelFile: 'C\\\\:/tmp/canal.txt',
    }).filters.join(',');
    expect(comCanal).toContain('arte local · sem personagem');
    expect(comCanal).toContain(PATHS.font);
  });
});
