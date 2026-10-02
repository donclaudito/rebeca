/**
 * Roteiro e storyboard — o insumo que a etapa **Criar** não tinha onde guardar.
 *
 * Contexto do defeito: `ContentItem` só tinha SEO e thumbnails, então "gerar o vídeo" não tinha de onde
 * partir. `criar-roteiro` e `criar-cena` estavam registradas no contrato desde a camada de LLM e
 * **nenhuma tela as chamava**. O dono do produto olhou o espaço do vídeo, disse *"esta função não
 * funciona, usa ai para gerar video"* e estava certo: não havia função, e o insumo da função não existia.
 *
 * O que se testa aqui é o que a **gravação** faz com o conteúdo — e os quatro modos de falha que
 * importam:
 *
 * 1. **Storyboard sem roteiro.** Cena sem narração de origem é linhagem inventada (a mesma regra que
 *    impede a tela de ligar conteúdo e episódio por semelhança de nome).
 * 2. **Storyboard órfão depois de roteiro novo.** As cenas apontariam para narração que deixou de
 *    existir — estado mentiroso.
 * 3. **Aprovação sobrevivendo à mudança.** Gravar roteiro num conteúdo aprovado tem de **derrubar** a
 *    aprovação: o que iria ao ar deixou de ser o que o humano aprovou.
 * 4. **Texto de fora sem teto.** A saída da IA é dado externo; ela entra no conteúdo, vira prompt de
 *    imagem depois, e não pode chegar crua nem com `NaN` no meio.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { api, resetStore } from '@/data/client';
import type { Roteiro, Storyboard } from '@/data/types';

const CONTEUDO = 'luna-arcoiris';
const CANAL = 'luna';

const ROTEIRO: Roteiro = {
  titulo: 'Luna e o Arco-íris',
  logline: 'A Luna descobre que o arco-íris junta todas as cores que ela já conhece.',
  moral: 'Toda cor tem seu lugar.',
  blocos: [
    {
      ordem: 1,
      tempoInicioSeg: 0,
      tempoFimSeg: 12,
      narracao: 'A chuva para e o sol volta a brilhar no jardim.',
      acao: 'Luna abre a janela e aponta para o céu.',
      emocao: 'surpresa',
    },
    {
      ordem: 2,
      tempoInicioSeg: 12,
      tempoFimSeg: 28,
      narracao: 'Ela conta as cores do arco-íris, uma por uma.',
      acao: 'Luna desenha o arco no chão de terra.',
      emocao: 'alegria',
    },
  ],
  geradoEm: '2026-10-01T12:00:00.000Z',
  promptId: 'criar-roteiro@v1',
  simulated: false,
};

const STORYBOARD: Storyboard = {
  cenas: [
    {
      numero: 1,
      duracaoSeg: 12,
      descricao: 'Luna na janela, céu abrindo depois da chuva.',
      enquadramento: 'plano médio',
      paleta: ['#7DD3FC', '#FDE68A'],
      promptImagem: 'Menina pequena e arredondada na janela, céu azul claro após a chuva, sem texto na arte.',
      negativePrompt: 'texto, marca d\u2019água',
      seed: 101,
    },
    {
      numero: 2,
      duracaoSeg: 16,
      descricao: 'Luna desenhando o arco-íris no chão.',
      enquadramento: 'plano aberto',
      paleta: ['#F472B6', '#A78BFA'],
      promptImagem: 'Menina pequena e arredondada desenhando um arco-íris no chão de terra do jardim.',
      negativePrompt: 'texto, marca d\u2019água',
      seed: 202,
    },
  ],
  geradoEm: '2026-10-01T12:05:00.000Z',
  promptId: 'criar-cena@v1',
  simulated: false,
};

describe('roteiro e storyboard do conteúdo', () => {
  beforeEach(() => {
    resetStore();
  });

  it('grava o roteiro com os blocos e a procedência', async () => {
    const antes = await api.getContent(CANAL, CONTEUDO);
    expect(antes.roteiro).toBeUndefined();

    const depois = await api.saveRoteiro(CANAL, CONTEUDO, ROTEIRO);

    expect(depois.roteiro?.titulo).toBe('Luna e o Arco-íris');
    expect(depois.roteiro?.blocos).toHaveLength(2);
    // A procedência viaja junto: sem ela a tela não consegue dizer se aquilo é simulação.
    expect(depois.roteiro?.simulated).toBe(false);
    expect(depois.roteiro?.promptId).toBe('criar-roteiro@v1');
  });

  it('grava o storyboard depois do roteiro', async () => {
    await api.saveRoteiro(CANAL, CONTEUDO, ROTEIRO);
    const depois = await api.saveStoryboard(CANAL, CONTEUDO, STORYBOARD);

    expect(depois.storyboard?.cenas).toHaveLength(2);
    // `promptImagem` e `seed` são o que a etapa de imagem precisa para ser determinística.
    expect(depois.storyboard?.cenas[0]?.promptImagem).toContain('janela');
    expect(depois.storyboard?.cenas[0]?.seed).toBe(101);
  });

  it('recusa storyboard sem roteiro — cena sem narração de origem é linhagem inventada', async () => {
    await expect(api.saveStoryboard(CANAL, CONTEUDO, STORYBOARD)).rejects.toThrow(/roteiro antes do storyboard/i);
  });

  it('gerar roteiro novo descarta o storyboard antigo', async () => {
    await api.saveRoteiro(CANAL, CONTEUDO, ROTEIRO);
    await api.saveStoryboard(CANAL, CONTEUDO, STORYBOARD);
    expect((await api.getContent(CANAL, CONTEUDO)).storyboard).toBeDefined();

    const depois = await api.saveRoteiro(CANAL, CONTEUDO, { ...ROTEIRO, titulo: 'Luna e o Arco-íris (v2)' });

    // Estado mentiroso seria manter cenas apontando para a narração que deixou de existir.
    expect(depois.storyboard).toBeUndefined();
    expect(depois.roteiro?.titulo).toBe('Luna e o Arco-íris (v2)');
  });

  it('gravar roteiro num conteúdo aprovado derruba a aprovação', async () => {
    await api.selectThumbnail(CANAL, CONTEUDO, 't1');
    const aprovado = await api.approve(CANAL, CONTEUDO, null);
    expect(aprovado.approval).not.toBeNull();

    const depois = await api.saveRoteiro(CANAL, CONTEUDO, ROTEIRO);

    expect(depois.approval).toBeNull();
    expect(depois.status).toBe('revisao');
  });

  it('recusa gravar em conteúdo de outro canal', async () => {
    await expect(api.saveRoteiro('arquivo', CONTEUDO, ROTEIRO)).rejects.toThrow();
    await expect(api.saveStoryboard('arquivo', CONTEUDO, STORYBOARD)).rejects.toThrow();
  });

  it('recusa roteiro sem blocos e storyboard sem cenas', async () => {
    await expect(api.saveRoteiro(CANAL, CONTEUDO, { ...ROTEIRO, blocos: [] })).rejects.toThrow(/nenhum bloco/i);

    await api.saveRoteiro(CANAL, CONTEUDO, ROTEIRO);
    await expect(api.saveStoryboard(CANAL, CONTEUDO, { ...STORYBOARD, cenas: [] })).rejects.toThrow(/nenhuma cena/i);
  });

  it('corta texto sem teto, neutraliza caractere de controle e não guarda NaN', async () => {
    const bruto: Roteiro = {
      ...ROTEIRO,
      titulo: 'T'.repeat(500),
      blocos: Array.from({ length: 60 }, (_, index) => ({
        ordem: Number.NaN,
        tempoInicioSeg: Number.NaN,
        tempoFimSeg: Number.NaN,
        narracao: `Narração ${index}\u0000 com controle`.repeat(50),
        acao: 'A',
        emocao: 'E'.repeat(200),
      })),
    };

    const depois = await api.saveRoteiro(CANAL, CONTEUDO, bruto);

    expect(depois.roteiro?.titulo.length).toBeLessThanOrEqual(100);
    // Teto do schema da função `criar-roteiro` (`maxItems: 40`).
    expect(depois.roteiro?.blocos).toHaveLength(40);
    const primeiro = depois.roteiro?.blocos[0];
    expect(primeiro?.narracao.length).toBeLessThanOrEqual(1200);
    expect(primeiro?.narracao).not.toContain('\u0000');
    // `NaN` atravessando viraria "NaN" na tela e no CSV depois.
    expect(Number.isFinite(primeiro?.ordem)).toBe(true);
    expect(Number.isFinite(primeiro?.tempoInicioSeg)).toBe(true);
    expect(Number.isFinite(primeiro?.tempoFimSeg)).toBe(true);
    expect(primeiro?.emocao.length).toBeLessThanOrEqual(60);
  });
});
