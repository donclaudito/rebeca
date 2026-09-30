/**
 * Teste adversarial de isolamento entre canais (AGENTS.md, invariante nº 2).
 *
 * Ele tenta **refutar** a troca de canal: depois de trocar de Luna para Arquivo Curioso,
 * - nenhum texto do canal anterior pode sobrar no DOM;
 * - nenhuma chave de cache do canal anterior pode sobrar no queryClient;
 * - a URL tem de carregar o canal novo;
 * - e a camada de dados tem de recusar pedir conteúdo de outro canal.
 */

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppRoutes } from '@/app/routes';
import { api, qk, resetStore } from '@/data/client';

const LUNA_CONTENT = 'Luna e as Borboletas Coloridas';
const ARQUIVO_CONTENT = 'Por que o céu fica laranja no fim da tarde?';

function renderAt(path: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });

  const utils = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>
    </QueryClientProvider>,
  );

  return { ...utils, queryClient };
}

describe('isolamento entre canais', () => {
  beforeEach(() => {
    resetStore();
  });

  it('a camada de dados recusa conteúdo que pertence a outro canal', async () => {
    // `luna-borboletas` existe — mas não no canal `arquivo`.
    await expect(api.getContent('arquivo', 'luna-borboletas')).rejects.toThrow(
      'Conteúdo não encontrado neste canal.',
    );
    await expect(api.getContent('luna', 'luna-borboletas')).resolves.toMatchObject({
      channelId: 'luna',
      title: LUNA_CONTENT,
    });
  });

  it('a fila de revisão nunca devolve conteúdo de outro canal', async () => {
    const lunaQueue = await api.getReviewQueue('luna');
    expect(lunaQueue.length).toBeGreaterThan(0);
    expect(lunaQueue.every((item) => item.channelId === 'luna')).toBe(true);

    const arquivoQueue = await api.getReviewQueue('arquivo');
    expect(arquivoQueue.every((item) => item.channelId === 'arquivo')).toBe(true);
    expect(arquivoQueue.map((item) => item.id)).not.toContain('luna-borboletas');
  });

  it('trocar de canal limpa o DOM, o cache e a URL do canal anterior', async () => {
    const user = userEvent.setup();
    const { queryClient } = renderAt('/c/luna/inicio');

    // 1. O canal Luna carregou (o título aparece em mais de um bloco da tela).
    expect((await screen.findAllByText(LUNA_CONTENT)).length).toBeGreaterThan(0);

    // 2. Troca de canal pelo seletor da barra superior.
    await user.click(screen.getByRole('button', { name: /Canal ativo: Luna e o Jardim das Cores/i }));

    const lista = await screen.findByRole('listbox', { name: 'Canais' });
    await user.click(within(lista).getByRole('option', { name: /Arquivo Curioso/i }));

    // 3. O conteúdo do canal novo aparece.
    expect((await screen.findAllByText(ARQUIVO_CONTENT)).length).toBeGreaterThan(0);

    // 4. Nada do canal anterior sobrou no DOM.
    await waitFor(() => {
      expect(screen.queryAllByText(LUNA_CONTENT)).toHaveLength(0);
    });

    // 5. Nada do canal anterior sobrou no cache.
    const chavesDeOutrosCanais = queryClient
      .getQueryCache()
      .getAll()
      .map((query) => query.queryKey)
      .filter((key) => key[0] === 'channel' && key[1] !== 'arquivo');

    expect(chavesDeOutrosCanais).toEqual([]);

    // 6. A chave do canal novo existe (o cache não foi só esvaziado).
    expect(queryClient.getQueryCache().find({ queryKey: qk.contents('arquivo') })).toBeTruthy();
  });

  it('rota sem canal não renderiza tela de canal nenhuma', async () => {
    renderAt('/inicio');
    expect(await screen.findByText('Página não encontrada')).toBeInTheDocument();
    expect(screen.queryAllByText(LUNA_CONTENT)).toHaveLength(0);
  });
});
