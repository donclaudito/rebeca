/**
 * Teste do fluxo crítico: revisar → escolher thumbnail → aprovar.
 *
 * Tenta refutar três coisas que doem no produto:
 * 1. aprovar sem escolher thumbnail (a IA não escolhe pelo humano);
 * 2. aprovar duas vezes (dupla submissão = publicação duplicada);
 * 3. rejeitar sem dizer o motivo (sem motivo não há aprendizado).
 */

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '@/app/routes';
import { api, resetStore } from '@/data/client';

function renderReview() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/c/luna/revisao/luna-borboletas']}>
        <AppRoutes />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('tela de revisão', () => {
  beforeEach(() => {
    resetStore();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('não deixa aprovar sem thumbnail escolhida, e nenhuma opção vem pré-marcada', async () => {
    renderReview();

    const aprovar = await screen.findByRole('button', { name: /Aprovar e agendar/i });
    expect(aprovar).toBeDisabled();

    const grupo = screen.getByRole('radiogroup', { name: /Opções de thumbnail/i });

    // A sugestão da IA aparece rotulada como sugestão dentro do grupo de opções...
    expect(within(grupo).getAllByText(/sugestão da IA/i).length).toBeGreaterThan(0);
    // ...mas nenhuma opção vem marcada como escolha do humano.
    expect(within(grupo).queryByText(/Escolhida por você/i)).not.toBeInTheDocument();

    for (const radio of within(grupo).getAllByRole('radio')) {
      expect(radio).toHaveAttribute('aria-checked', 'false');
    }
  });

  it('aprova uma única vez mesmo com dois cliques seguidos', async () => {
    const user = userEvent.setup();
    const approveSpy = vi.spyOn(api, 'approve');

    renderReview();

    const grupo = await screen.findByRole('radiogroup', { name: /Opções de thumbnail/i });
    await user.click(within(grupo).getAllByRole('radio')[0] as HTMLElement);

    const aprovar = await screen.findByRole('button', { name: /Aprovar e agendar/i });
    await waitFor(() => expect(aprovar).toBeEnabled());

    await user.click(aprovar);
    await user.click(aprovar);

    await waitFor(() => expect(approveSpy).toHaveBeenCalledTimes(1));
  });

  it('rejeitar exige motivo, e o motivo vira o registro de aprendizado', async () => {
    const user = userEvent.setup();
    renderReview();

    await user.click(await screen.findByRole('button', { name: /Substituir conteúdo/i }));

    const confirmar = screen.getByRole('button', { name: /Confirmar substituição/i });
    expect(confirmar).toBeDisabled();

    await user.type(
      screen.getByLabelText(/Por que este conteúdo não serve\?/i),
      'O ritmo está lento demais para 3 a 5 anos.',
    );

    await waitFor(() => expect(confirmar).toBeEnabled());

    const rejectSpy = vi.spyOn(api, 'reject');
    await user.click(confirmar);

    await waitFor(() => expect(rejectSpy).toHaveBeenCalledTimes(1));

    // A gravação é assíncrona: espera o motivo chegar no registro do conteúdo.
    await waitFor(async () => {
      const atualizado = await api.getContent('luna', 'luna-borboletas');
      expect(atualizado.rejectedReason).toBe('O ritmo está lento demais para 3 a 5 anos.');
      expect(atualizado.status).toBe('gerando');
    });
  });

  it('a camada de dados recusa aprovar sem thumbnail mesmo que a tela falhe', async () => {
    await expect(api.approve('arquivo', 'arq-ceu-laranja', null)).rejects.toThrow(
      'Escolha uma thumbnail antes de aprovar.',
    );
  });

  it('a tela diz o que EXISTE, e não afirma mídia que nunca foi gerada', async () => {
    /*
     * Relato do dono do produto ao ler o subtítulo da tela ("Assista, escolha a thumbnail…"): "não
     * parece que funciona". Ele estava certo: o cartão "O que a IA fez aqui" listava, com checkmarks
     * verdes, "Roteiro, cenas, narração e montagem prontos" e "opções de thumbnail geradas" — e não
     * existe um único arquivo de vídeo no repositório, nem narração, nem arte de thumbnail (o quadro é
     * um `ArtSlot`). A tela afirmava trabalho que nunca aconteceu.
     *
     * Este teste fixa a honestidade: nada de "prontos" para o que não foi gerado, o estado pendente
     * escrito com todas as letras, e as três decisões preservadas — consertar a verdade não pode
     * remover o fluxo.
     */
    renderReview();

    expect(await screen.findByText('O que existe neste conteúdo')).toBeInTheDocument();
    expect(screen.getByText(/Nenhum vídeo, narração ou montagem gerados ainda/i)).toBeInTheDocument();
    expect(screen.getByText(/a arte ainda não existe/i)).toBeInTheDocument();
    // As afirmações falsas não podem voltar.
    expect(screen.queryByText(/narração e montagem prontos/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/opções de thumbnail geradas/i)).not.toBeInTheDocument();
    // As três decisões continuam existindo.
    expect(screen.getByRole('button', { name: /Aprovar e agendar/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /gerar nova versão/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Substituir conteúdo/i })).toBeInTheDocument();
  });

  it('o espaço do player diz que nenhum vídeo foi gerado, e marca a duração como planejada', async () => {
    renderReview();

    expect(await screen.findByText(/nenhum vídeo foi gerado ainda/i)).toBeInTheDocument();
    expect(screen.getByText(/planejados/i)).toBeInTheDocument();
    // O rótulo antigo prometia um player que não existe.
    expect(screen.queryByText(/^Player ·/)).not.toBeInTheDocument();
  });

  it('dá para PEDIR opções de thumbnail à IA e aplicar as propostas', async () => {
    /*
     * Lacuna apontada pelo dono do produto: "não dá opção de gerar". A função `criar-thumbnail`
     * estava registrada no contrato desde a camada de LLM e **nenhuma tela a chamava** — a etapa
     * "Escolha a thumbnail" só mostrava o que já existisse, sem forma de pedir novas.
     *
     * Aqui o fluxo inteiro roda: pedir → a IA propõe conceitos → o humano aplica → as opções passam a
     * existir para escolha. O que a IA devolve é **conceito** (rótulo + o que a arte deve mostrar),
     * não imagem: gerar arte é do pipeline de mídia, e o teste não pode fingir que ela existe.
     */
    const propostas = {
      opcoes: [
        {
          id: 'p1',
          label: 'Close na Luna',
          alt: 'Primeiro plano da Luna com o arco-íris ao fundo',
          conceito: 'Rosto grande, expressão de espanto, fundo desfocado.',
          textoNaArte: 'SETE CORES',
          promptImagem: 'flat 2D children illustration, menina olhando o arco-íris',
          sugestao: true,
        },
        {
          id: 'p2',
          label: 'Arco-íris no céu',
          alt: 'Arco-íris completo sobre o jardim visto de longe',
          conceito: 'Plano aberto do jardim inteiro com o arco-íris.',
          textoNaArte: '',
          promptImagem: 'flat 2D children illustration, jardim com arco-íris',
          sugestao: false,
        },
        {
          id: 'p3',
          label: 'Luna apontando',
          alt: 'Luna apontando para uma das cores do arco-íris',
          conceito: 'Ação de apontar, dedo na cor.',
          textoNaArte: 'QUAL É A SUA?',
          promptImagem: 'flat 2D children illustration, menina apontando para o céu',
          sugestao: false,
        },
      ],
    };

    const fetchMock = vi.fn(
      async (_url: string, _init?: RequestInit) =>
        new Response(
          JSON.stringify({
            functionId: 'criar-thumbnail',
            channelId: 'luna',
            promptId: 'criar-thumbnail',
            promptVersion: 1,
            tier: 'criativo',
            provider: 'openai',
            model: 'gpt-6-luna',
            simulated: false,
            data: propostas,
            usage: { tokensIn: 200, tokensOut: 300 },
            costUsd: 0.0002,
            costSource: 'real',
            costRecorded: 'csv',
            latencyMs: 800,
            createdAt: '2026-10-01T12:00:00.000Z',
            attempts: 1,
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
    );
    vi.stubGlobal('fetch', fetchMock);

    renderReview();
    const user = userEvent.setup();

    await user.click(
      await screen.findByRole('button', { name: /Gerar opções de thumbnail com a IA/i }),
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(String(fetchMock.mock.calls[0]?.[1]?.body)).toContain('criar-thumbnail');

    // Nada é aplicado sem o clique humano (invariante nº 1). O `AiAction` **mostra** a proposta —
    // isso é dele e tem teste próprio —, mas as opções da tela continuam as antigas até o clique.
    const grupoAntes = screen.getByRole('radiogroup', { name: /Opções de thumbnail/i });
    expect(within(grupoAntes).queryByText('Close na Luna')).not.toBeInTheDocument();

    await user.click(await screen.findByRole('button', { name: /Usar estas opções/i }));

    // Espera a regravação CHEGAR À TELA: as 4 opções do dado de exemplo dão lugar às 3 propostas.
    // (Sem este `waitFor`, a asserção casaria com a prévia da resposta da IA, que é outra coisa.)
    await waitFor(() => {
      const grupoAtual = screen.getByRole('radiogroup', { name: /Opções de thumbnail/i });
      expect(within(grupoAtual).getAllByRole('radio')).toHaveLength(3);
    });

    const grupo = screen.getByRole('radiogroup', { name: /Opções de thumbnail/i });
    // O rótulo aparece duas vezes dentro do cartão (no quadro reservado e embaixo dele) — por isso
    // `getAllByText`, e não `getByText`.
    expect(within(grupo).getAllByText('Close na Luna').length).toBeGreaterThan(0);
    // Nenhuma vem marcada: a sugestão da IA é informativa, escolher é do humano.
    for (const opcao of within(grupo).getAllByRole('radio')) {
      expect(opcao).toHaveAttribute('aria-checked', 'false');
    }
  });
});
