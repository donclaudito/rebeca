/**
 * Teste das **duas barras laterais** (pedido do dono: "as barras laterais têm que ter função de
 * fechar/abrir, tanto da direita quanto da esquerda").
 *
 * O que ele tenta refutar:
 * 1. um botão que diz que abre/fecha e não muda nada (`aria-expanded` mentiroso);
 * 2. a barra direita "fechar" só na intenção: o contrato real é o atributo
 *    `data-rail-right` no `<html>`, porque quem esconde a coluna é o CSS de
 *    `components.css` (a coluna é escrita por cada tela, não pela casca);
 * 3. `aria-controls` apontando para um id que não existe no DOM.
 *
 * O jsdom não aplica a folha de estilo, então este teste **não** prova que a coluna some na tela —
 * prova que o contrato que o CSS lê está certo. A conferência visual é a pendência declarada no
 * `docs/03` §10.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppRoutes } from '@/app/routes';
import { resetStore } from '@/data/client';
import { GUIDE_STORAGE_KEY, RIGHT_STORAGE_KEY } from '@/app/shell';

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

describe('barras laterais abrem e fecham', () => {
  beforeEach(() => {
    resetStore();
    window.localStorage.clear();
    document.documentElement.removeAttribute('data-rail-right');
  });

  it('as duas nascem abertas, com os dois controles no masthead', async () => {
    renderAt('/c/luna/inicio');

    const esquerda = await screen.findByRole('button', { name: 'Menu de navegação' });
    const direita = screen.getByRole('button', { name: 'Painel lateral' });

    expect(esquerda).toHaveAttribute('aria-expanded', 'true');
    expect(direita).toHaveAttribute('aria-expanded', 'true');
  });

  it('o botão da esquerda fecha e reabre, e o X de dentro da barra também fecha', async () => {
    const user = userEvent.setup();
    renderAt('/c/luna/inicio');

    const esquerda = await screen.findByRole('button', { name: 'Menu de navegação' });
    const alvo = document.getElementById('barra-lateral-esquerda');
    expect(alvo).not.toBeNull();

    // O botão aponta para um alvo que existe (aria-controls não é enfeite).
    expect(esquerda).toHaveAttribute('aria-controls', 'barra-lateral-esquerda');

    await user.click(esquerda);
    expect(esquerda).toHaveAttribute('aria-expanded', 'false');
    expect(window.localStorage.getItem(GUIDE_STORAGE_KEY)).toBe('fechada');

    await user.click(esquerda);
    expect(esquerda).toHaveAttribute('aria-expanded', 'true');
    expect(window.localStorage.getItem(GUIDE_STORAGE_KEY)).toBe('aberta');

    // O "X" dentro da barra faz a mesma coisa — quem procura como fechar procura ali.
    await user.click(screen.getByRole('button', { name: 'Fechar o menu de navegação' }));
    expect(esquerda).toHaveAttribute('aria-expanded', 'false');
  });

  it('o botão da direita fecha e reabre, e publica o contrato que o CSS lê', async () => {
    const user = userEvent.setup();
    renderAt('/c/luna/inicio');

    const direita = await screen.findByRole('button', { name: 'Painel lateral' });
    const coluna = document.getElementById('barra-lateral-direita');

    expect(coluna).not.toBeNull();
    expect(direita).toHaveAttribute('aria-controls', 'barra-lateral-direita');
    expect(document.documentElement.dataset.railRight).toBe('open');

    await user.click(direita);

    expect(direita).toHaveAttribute('aria-expanded', 'false');
    expect(document.documentElement.dataset.railRight).toBe('closed');
    expect(window.localStorage.getItem(RIGHT_STORAGE_KEY)).toBe('fechada');

    await user.click(direita);

    expect(direita).toHaveAttribute('aria-expanded', 'true');
    expect(document.documentElement.dataset.railRight).toBe('open');
    expect(window.localStorage.getItem(RIGHT_STORAGE_KEY)).toBe('aberta');
  });

  it('a escolha sobrevive à remontagem da casca (preferência do usuário, não do canal)', async () => {
    const user = userEvent.setup();
    const first = renderAt('/c/luna/inicio');

    await user.click(await screen.findByRole('button', { name: 'Painel lateral' }));
    expect(document.documentElement.dataset.railRight).toBe('closed');

    first.unmount();

    renderAt('/c/luna/inicio');

    const direita = await screen.findByRole('button', { name: 'Painel lateral' });
    expect(direita).toHaveAttribute('aria-expanded', 'false');
    expect(document.documentElement.dataset.railRight).toBe('closed');
  });
});
