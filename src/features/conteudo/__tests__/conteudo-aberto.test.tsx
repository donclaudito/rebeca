/**
 * O conteúdo aberto (`?aberto=<id>`) na biblioteca do canal.
 *
 * Defeito que estes testes cobrem, relatado pelo dono do produto ao olhar um cartão: "esta parte
 * parece sem função". Os três lugares que mostram conteúdo (biblioteca, calendário e início) já
 * apontavam para `/c/:canal/conteudo?aberto=<id>` — e a tela de destino **nunca leu o parâmetro**. O
 * clique levava para a mesma página, sem abrir nada; dentro da própria biblioteca, o cartão apontava
 * para a rota em que o usuário já estava. O contrato existia de um lado só.
 *
 * O que se exige aqui: o parâmetro abre o conteúdo, o cartão correspondente fica marcado, o botão de
 * fechar desfaz, e — o mais importante — um `id` de **outro canal** não mostra nada do canal alheio
 * (AGENTS.md, invariante nº 2). Sem esse último caso, "abrir por id" seria uma porta de vazamento.
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppRoutes } from '@/app/routes';
import { resetStore } from '@/data/client';

const LUNA_AGENDADO = 'luna-arcoiris';
const LUNA_TITULO = 'Luna ensina as cores do arco-íris';
/** Conteúdo do canal `arquivo` — existe, mas não neste canal. */
const ARQUIVO_ID = 'arq-ceu-laranja';
const ARQUIVO_TITULO = 'Por que o céu fica laranja no fim da tarde?';

function renderAt(path: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('conteúdo aberto na biblioteca', () => {
  beforeEach(() => {
    resetStore();
  });

  it('abre o conteúdo apontado por ?aberto= em vez de ignorar o parâmetro', async () => {
    renderAt(`/c/luna/conteudo?aberto=${LUNA_AGENDADO}`);

    expect(await screen.findByText('Conteúdo aberto')).toBeInTheDocument();
    // O título de SEO só existe no painel — no cartão da grade aparece apenas o título do vídeo.
    expect(screen.getByText(/🌈 #shorts/)).toBeInTheDocument();
    // O atalho para a tela que decide, com o id certo.
    expect(screen.getByRole('link', { name: /Abrir na revisão/i })).toHaveAttribute(
      'href',
      `/c/luna/revisao/${LUNA_AGENDADO}`,
    );
  });

  it('marca o cartão do conteúdo aberto na grade', async () => {
    const { container } = renderAt(`/c/luna/conteudo?aberto=${LUNA_AGENDADO}`);
    await screen.findByText('Conteúdo aberto');

    const marcados = container.querySelectorAll('[aria-current="true"]');
    expect(marcados.length).toBe(1);
  });

  it('id de OUTRO canal não vaza nada: avisa e não mostra o conteúdo alheio', async () => {
    const { container } = renderAt(`/c/luna/conteudo?aberto=${ARQUIVO_ID}`);

    expect(await screen.findByText(/não está neste canal/i)).toBeInTheDocument();
    // Nem o painel, nem o conteúdo do outro canal.
    expect(screen.queryByText('Conteúdo aberto')).not.toBeInTheDocument();
    expect(container.textContent).not.toContain(ARQUIVO_TITULO);
  });

  it('fechar tira o conteúdo da tela', async () => {
    renderAt(`/c/luna/conteudo?aberto=${LUNA_AGENDADO}`);
    await screen.findByText('Conteúdo aberto');

    await userEvent.setup().click(screen.getByRole('button', { name: /Fechar o conteúdo aberto/i }));

    await waitFor(() => expect(screen.queryByText('Conteúdo aberto')).not.toBeInTheDocument());
  });

  it('o cartão da biblioteca aponta para o conteúdo aberto (o contrato que estava quebrado)', async () => {
    renderAt('/c/luna/conteudo');

    const capa = await screen.findByRole('link', { name: `Abrir ${LUNA_TITULO}` });
    expect(capa).toHaveAttribute('href', `/c/luna/conteudo?aberto=${LUNA_AGENDADO}`);
  });
});
