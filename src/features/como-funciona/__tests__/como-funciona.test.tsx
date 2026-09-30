/**
 * Refuta a divergência entre o ciclo que o produto declara e o ciclo que a tela mostra.
 *
 * "Como funciona" é a página onde o usuário aprende o processo. Se ela listar 9 passos, fundir
 * Agendar com Publicar ou chamar a última etapa de "Ajustar", o produto ensina errado — e o código
 * (`src/data/types.ts`) já esteve assim.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AppRoutes } from '@/app/routes';
import { CYCLE_LABEL, CYCLE_ORDER } from '@/data/cycle';

function renderComoFunciona() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/como-funciona']}>
        <AppRoutes />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('tela "Como funciona"', () => {
  it('mostra as 10 etapas do ciclo, numeradas na ordem canônica', async () => {
    renderComoFunciona();

    const lista = await screen.findByRole('list', { name: /etapas do ciclo/i });
    const itens = within(lista).getAllByRole('listitem');

    expect(itens).toHaveLength(CYCLE_ORDER.length);

    const textos = itens.map((item) => item.textContent ?? '');
    CYCLE_ORDER.forEach((stage, index) => {
      expect(textos[index]).toContain(`${index + 1}. ${CYCLE_LABEL[stage]}`);
    });
  });

  it('não funde Agendar com Publicar e não fala mais em "Ajustar"', async () => {
    renderComoFunciona();

    const lista = await screen.findByRole('list', { name: /etapas do ciclo/i });

    expect(within(lista).queryByText(/Agendar e publicar/i)).not.toBeInTheDocument();
    expect(within(lista).getByText(/Agendar/, { selector: '.ams-module__title' })).toBeInTheDocument();
    expect(within(lista).getByText(/Publicar/, { selector: '.ams-module__title' })).toBeInTheDocument();
    expect(within(lista).queryByText(/Ajustar/)).not.toBeInTheDocument();
    expect(within(lista).getByText(/Melhorar/, { selector: '.ams-module__title' })).toBeInTheDocument();
  });

  it('continua dizendo que o passo da aprovação é humano', async () => {
    renderComoFunciona();

    const posicao = CYCLE_ORDER.indexOf('aprovar') + 1;
    expect(
      await screen.findByText(new RegExp(`O passo ${posicao} é o único que ninguém pode fazer`)),
    ).toBeInTheDocument();
  });
});
