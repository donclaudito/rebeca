/**
 * Gravação das opções de thumbnail propostas pela IA.
 *
 * Esta função é a porta que faltava: `criar-thumbnail` existia registrada no contrato e
 * **nenhuma tela a chamava** — o dono do produto olhou a etapa "Escolha a thumbnail" e a conclusão
 * foi "não dá opção de gerar". O que se testa aqui é o que a gravação **faz** com o conteúdo:
 *
 * 1. substitui as opções (e não acumula lixo de execuções anteriores);
 * 2. **limpa a escolha anterior** — manter um `selectedThumbnailId` apontando para uma opção que não
 *    existe mais seria estado mentiroso, e a escolha é do humano (invariante nº 1);
 * 3. **derruba a aprovação** de um conteúdo já aprovado, devolvendo-o para revisão: o que iria ao ar
 *    deixou de ser o que o humano aprovou (é o mesmo caminho de `selectThumbnail` e `saveTitle`);
 * 4. recusa outro canal e recusa lista vazia.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { api, resetStore } from '@/data/client';
import type { ThumbnailOption } from '@/data/types';

const OPCOES: ThumbnailOption[] = [
  {
    id: 'p1',
    label: 'Close na Luna',
    alt: 'Primeiro plano da Luna com o arco-íris ao fundo',
    suggested: true,
  },
  {
    id: 'p2',
    label: 'Arco-íris inteiro no céu',
    alt: 'Arco-íris completo sobre o jardim visto de longe',
    suggested: false,
  },
];

describe('opções de thumbnail propostas pela IA', () => {
  beforeEach(() => {
    resetStore();
  });

  it('substitui as opções e limpa a escolha anterior', async () => {
    const antes = await api.getContent('luna', 'luna-arcoiris');
    // O dado de exemplo já vem com uma escolhida — é o que torna a limpeza verificável.
    expect(antes.selectedThumbnailId).not.toBeNull();

    const depois = await api.proposeThumbnails('luna', 'luna-arcoiris', OPCOES);

    expect(depois.thumbnails.map((thumb) => thumb.id)).toEqual(['p1', 'p2']);
    expect(depois.thumbnails[0]?.suggested).toBe(true);
    expect(depois.selectedThumbnailId).toBeNull();
  });

  it('trocar a thumbnail de um conteúdo aprovado derruba a aprovação', async () => {
    await api.selectThumbnail('luna', 'luna-arcoiris', 't1');
    const aprovado = await api.approve('luna', 'luna-arcoiris', null);
    expect(aprovado.approval).not.toBeNull();

    const depois = await api.proposeThumbnails('luna', 'luna-arcoiris', OPCOES);

    expect(depois.approval).toBeNull();
    expect(depois.status).toBe('revisao');
  });

  it('recusa aplicar opções em conteúdo de outro canal', async () => {
    // `luna-arcoiris` não pertence ao canal `arquivo`: a camada de dados tem de recusar.
    await expect(api.proposeThumbnails('arquivo', 'luna-arcoiris', OPCOES)).rejects.toThrow();
  });

  it('recusa lista vazia em vez de apagar as opções que existem', async () => {
    await expect(api.proposeThumbnails('luna', 'luna-arcoiris', [])).rejects.toThrow(/nenhuma opção/i);
  });

  it('não guarda mais de quatro opções nem texto sem teto', async () => {
    const muitas: ThumbnailOption[] = Array.from({ length: 7 }, (_, index) => ({
      id: `x${index}`,
      label: 'L'.repeat(200),
      alt: 'A'.repeat(500),
      suggested: false,
    }));

    const depois = await api.proposeThumbnails('luna', 'luna-arcoiris', muitas);

    expect(depois.thumbnails).toHaveLength(4);
    expect(depois.thumbnails[0]?.label.length).toBeLessThanOrEqual(60);
    expect(depois.thumbnails[0]?.alt.length).toBeLessThanOrEqual(300);
  });
});
