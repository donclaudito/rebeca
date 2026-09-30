/**
 * Teste adversarial do gate de aprovação humana (AGENTS.md, invariante nº 1:
 * "Nada vai ao YouTube sem aprovação explícita").
 *
 * Ele tenta **refutar** a afirmação "o que foi aprovado é o que vai ao ar" e a afirmação
 * "o gate segura entrada inválida". Cada caso abaixo descreve o ataque, não a implementação.
 *
 * Contexto do achado: a primeira versão de `src/data/client.ts` marcava `status: 'agendado'` em
 * `approve()` e **nada** impedia que `saveTitle()`, `selectThumbnail()` ou `reschedule()`
 * mudassem o conteúdo depois disso — o estado continuava `agendado`. Ou seja: dava para aprovar um
 * vídeo e trocar o título, a descrição e a thumbnail antes de ele ir ao ar, sem nova aprovação.
 * A aprovação humana virava decorativa. Estes testes existem para que isso não volte.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { api, assertPublishable, contentSnapshot, isApprovalValid, resetStore } from '@/data/client';

/** Shorts aprovado nas sementes, com thumbnail escolhida — o caso "pronto para revisão de novo". */
const LUNA_SHORT = 'luna-abelhinha';
/** Vídeo em revisão, ainda sem thumbnail escolhida. */
const LUNA_REVISAO = 'luna-borboletas';
/** Vídeo já publicado — não se aprova nem se reagenda o que está no ar. */
const LUNA_PUBLICADO = 'luna-estrelas';

const EM_UMA_SEMANA = new Date(Date.now() + 7 * 86_400_000).toISOString();

describe('gate de aprovação humana', () => {
  beforeEach(() => {
    resetStore();
  });

  it('não deixa aprovar conteúdo sem thumbnail escolhida pelo humano', async () => {
    await expect(api.approve('luna', LUNA_REVISAO, null)).rejects.toThrow(
      'Escolha uma thumbnail antes de aprovar.',
    );
  });

  it('não deixa aprovar o que não está em revisão (já publicado)', async () => {
    await expect(api.approve('luna', LUNA_PUBLICADO, null)).rejects.toThrow();
  });

  it('não deixa aprovar conteúdo de outro canal', async () => {
    // `luna-abelhinha` existe, mas não no canal `arquivo`.
    await expect(api.approve('arquivo', LUNA_SHORT, null)).rejects.toThrow(
      'Conteúdo não encontrado neste canal.',
    );
  });

  it('editar o título DEPOIS de aprovado invalida a aprovação e volta o conteúdo para revisão', async () => {
    const aprovado = await api.approve('luna', LUNA_SHORT, null);
    expect(aprovado.status).toBe('aprovado');
    expect(aprovado.approval).not.toBeNull();

    const editado = await api.saveTitle('luna', LUNA_SHORT, 'Luna e a Abelhinha Amiga (v2)');

    // O ataque: o título que vai ao ar mudou depois da aprovação.
    // A defesa: a aprovação morre junto e o humano decide de novo.
    expect(editado.status).toBe('revisao');
    expect(editado.stage).toBe('revisar');
    expect(editado.approval).toBeNull();
  });

  it('trocar a thumbnail DEPOIS de aprovado invalida a aprovação', async () => {
    await api.approve('luna', LUNA_SHORT, null);

    const editado = await api.selectThumbnail('luna', LUNA_SHORT, 't2');

    expect(editado.selectedThumbnailId).toBe('t2');
    expect(editado.status).toBe('revisao');
    expect(editado.approval).toBeNull();
  });

  it('reagendar NÃO invalida a aprovação: o conteúdo aprovado não mudou, só a data', async () => {
    const aprovado = await api.approve('luna', LUNA_SHORT, null);
    const snapshotAntes = aprovado.approval?.snapshot;

    const reagendado = await api.reschedule('luna', LUNA_SHORT, EM_UMA_SEMANA);

    expect(reagendado.status).toBe('agendado');
    expect(reagendado.scheduledAt).toBe(EM_UMA_SEMANA);
    expect(reagendado.approval).not.toBeNull();
    expect(reagendado.approval?.snapshot).toBe(snapshotAntes);
  });

  it('não deixa reagendar conteúdo já publicado', async () => {
    await expect(api.reschedule('luna', LUNA_PUBLICADO, EM_UMA_SEMANA)).rejects.toThrow();
  });

  it('a aprovação fica presa à versão aprovada: mexer no conteúdo é detectável', async () => {
    const item = await api.getContent('luna', LUNA_SHORT);
    const aprovado = await api.approve('luna', LUNA_SHORT, null);

    expect(isApprovalValid(aprovado)).toBe(true);

    // Simula escrita direta no registro (bug futuro, migração, ou agente que grava por fora da API):
    // mesmo conteúdo aprovado, mas com outro título. A aprovação não pode valer para ele.
    const adulterado = {
      ...item,
      approval: aprovado.approval,
      seo: { ...item.seo, title: 'Título trocado depois da aprovação' },
    };

    expect(contentSnapshot(adulterado)).not.toBe(aprovado.approval?.snapshot);
    expect(isApprovalValid(adulterado)).toBe(false);
  });

  it('o portão de publicação recusa o que não tem aprovação vigente', async () => {
    // Em revisão: sem aprovação nenhuma.
    await expect(assertPublishable('luna', LUNA_REVISAO)).rejects.toThrow();

    // Aprovado: passa.
    await api.approve('luna', LUNA_SHORT, null);
    await expect(assertPublishable('luna', LUNA_SHORT)).resolves.toMatchObject({
      id: LUNA_SHORT,
      channelId: 'luna',
    });

    // E depois de qualquer edição, volta a recusar.
    await api.saveTitle('luna', LUNA_SHORT, 'Outro título depois da aprovação');
    await expect(assertPublishable('luna', LUNA_SHORT)).rejects.toThrow();
  });

  it('o portão de publicação não atravessa canal', async () => {
    await api.approve('luna', LUNA_SHORT, null);
    await expect(assertPublishable('arquivo', LUNA_SHORT)).rejects.toThrow(
      'Conteúdo não encontrado neste canal.',
    );
  });

  it('existe registro da aprovação, com data e canal — e ele some quando invalidado', async () => {
    const aprovado = await api.approve('luna', LUNA_SHORT, EM_UMA_SEMANA);

    expect(aprovado.approval?.channelId).toBe('luna');
    expect(aprovado.approval?.contentId).toBe(LUNA_SHORT);
    expect(Number.isFinite(Date.parse(aprovado.approval?.approvedAt ?? ''))).toBe(true);
    expect(aprovado.approval?.scheduledAt).toBe(EM_UMA_SEMANA);

    const rejeitado = await api.reject('luna', LUNA_SHORT, 'Ritmo lento demais para 3 a 5 anos.');
    expect(rejeitado.approval).toBeNull();
  });

  it('recusa título fora do limite antes de gravar', async () => {
    await expect(api.saveTitle('luna', LUNA_SHORT, 'a'.repeat(101))).rejects.toThrow(
      'O título precisa ter no máximo 100 caracteres.',
    );
    await expect(api.saveTitle('luna', LUNA_SHORT, 'ab')).rejects.toThrow();
  });

  it('recusa título de uma linha só, sem controle embutido', async () => {
    const salvo = await api.saveTitle('luna', LUNA_SHORT, '  Luna   e a\n Abelhinha\u0000  ');
    expect(salvo.seo.title).toBe('Luna e a Abelhinha');
  });

  it('recusa motivo de rejeição fora do limite do schema de IA', async () => {
    await expect(api.reject('luna', LUNA_SHORT, 'x'.repeat(401))).rejects.toThrow();
    await expect(api.reject('luna', LUNA_SHORT, '  ')).rejects.toThrow();
  });

  it('recusa data de agendamento que não é data', async () => {
    await expect(api.reschedule('luna', LUNA_SHORT, 'amanhã de manhã')).rejects.toThrow(
      'Data e hora inválidas.',
    );
    await expect(api.reschedule('luna', LUNA_SHORT, '')).rejects.toThrow('Data e hora inválidas.');
    await expect(api.approve('luna', LUNA_SHORT, 'não é data')).rejects.toThrow(
      'Data e hora inválidas.',
    );
  });
});
