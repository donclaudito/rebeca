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
});
