/**
 * Teste de tela do `AiAction` — o componente que liga qualquer função de IA a uma tela.
 *
 * O que estes testes tentam refutar:
 *
 * 1. **Simulação disfarçada de geração real.** Se o servidor responder `simulated: true`, a tela tem
 *    de avisar. Uma tarja que sumisse faria o usuário tomar conteúdo de exemplo por conteúdo gerado.
 * 2. **Custo inventado.** Resposta com `costSource: 'nao-verificado'` não pode exibir valor de custo.
 * 3. **A IA aplicando sozinha.** `onApply` só pode rodar no clique do humano, e nunca no recebimento
 *    da resposta.
 * 4. **Erro silencioso.** Falha do servidor precisa aparecer com a mensagem em pt-BR que ele mandou,
 *    sem vazar detalhe técnico.
 *
 * A rede é substituída: nenhum teste aqui chama servidor de verdade, e menos ainda um provedor pago.
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AiAction } from '@/components/ai/AiAction';
import type { AiResult } from '@/ai/contract';

function renderAction(props: Partial<Parameters<typeof AiAction>[0]> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const onApply = vi.fn();

  render(
    <QueryClientProvider client={queryClient}>
      <AiAction
        functionId="revisar-qualidade"
        channelId="luna"
        input={{ titulo: 'Episódio de teste', roteiroResumo: 'Resumo longo o bastante.', formato: 'video' }}
        onApply={onApply}
        {...props}
      />
    </QueryClientProvider>,
  );

  return { onApply };
}

/** Resposta válida mínima, com os campos de procedência que o componente exibe. */
function aiResult(overrides: Partial<AiResult> = {}): AiResult {
  return {
    functionId: 'revisar-qualidade',
    channelId: 'luna',
    promptId: 'revisar-qualidade',
    promptVersion: 1,
    tier: 'raciocinio',
    provider: 'openai',
    model: 'gpt-6.1-sol',
    simulated: false,
    data: {
      veredito: 'precisa-ajuste',
      nota: 68,
      rubrica: { originalidade: 74, gancho: 62, clareza: 80, adequacaoEtaria: 58 },
      achados: [],
    },
    adjustments: [],
    usage: { tokensIn: 1200, tokensOut: 400 },
    costUsd: 0.0064,
    costSource: 'real',
    costRecorded: 'csv',
    latencyMs: 900,
    createdAt: '2026-10-01T12:00:00.000Z',
    attempts: 1,
    ...overrides,
  };
}

function stubFetch(payload: unknown, status = 200) {
  // Assinatura tipada de propósito: sem os parâmetros, `mock.calls` perde o tipo e o teste que
  // confere o corpo da requisição deixaria de compilar — foi o que aconteceu na primeira versão.
  const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('AiAction', () => {
  it('não chama a IA sozinho: só depois do clique', async () => {
    const fetchMock = stubFetch(aiResult());
    renderAction();

    expect(fetchMock).not.toHaveBeenCalled();

    await userEvent.setup().click(screen.getByRole('button', { name: /Executar/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const init = fetchMock.mock.calls[0]?.[1];
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    // O canal vai no corpo da requisição — não existe chamada de IA sem canal (invariante nº 2).
    expect(body['channelId']).toBe('luna');
    expect(body['functionId']).toBe('revisar-qualidade');
  });

  it('mostra o resultado e a procedência quando a geração é real', async () => {
    stubFetch(aiResult());
    renderAction();

    await userEvent.setup().click(screen.getByRole('button', { name: /Executar/i }));

    expect(await screen.findByText(/precisa-ajuste/i)).toBeInTheDocument();
    expect(screen.getByText(/proposta da IA/i)).toBeInTheDocument();
    expect(screen.queryByText(/simulado/i)).not.toBeInTheDocument();
  });

  it('NÃO mostra nome de fornecedor nem de modelo na interface comum', async () => {
    // `docs/04` §5: a interface não expõe termo interno — o usuário vê uma ferramenta só. O detalhe
    // técnico vive no bloco recolhido de Configurações, não na tela de conteúdo.
    stubFetch(aiResult({ provider: 'anthropic', model: 'claude-opus-5-5' }));
    renderAction();

    await userEvent.setup().click(screen.getByRole('button', { name: /Executar/i }));

    await screen.findByText(/precisa-ajuste/i);
    expect(screen.queryByText(/anthropic/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/claude/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/revisar-qualidade@v/i)).not.toBeInTheDocument();
  });

  it('AVISA quando a resposta é simulação — não deixa passar por geração real', async () => {
    stubFetch(
      aiResult({
        simulated: true,
        provider: 'simulado',
        model: 'simulado',
        costSource: 'nao-verificado',
        costUsd: 0,
        costRecorded: 'nenhum',
      }),
    );
    renderAction();

    await userEvent.setup().click(screen.getByRole('button', { name: /Executar/i }));

    expect(await screen.findByText(/simulação/i)).toBeInTheDocument();
    // E diz que nada foi lançado no livro de custos.
    expect(screen.getByText(/sem gasto/i)).toBeInTheDocument();
  });

  it('não exibe valor de custo quando o preço não foi verificado', async () => {
    stubFetch(aiResult({ costSource: 'nao-verificado', costUsd: 0 }));
    renderAction();

    await userEvent.setup().click(screen.getByRole('button', { name: /Executar/i }));

    expect(await screen.findByText(/custo não verificado/i)).toBeInTheDocument();
  });

  it('mostra o erro em pt-BR vindo do servidor, sem jargão de provedor', async () => {
    stubFetch(
      {
        code: 'teto-diario',
        message: 'O teto diário de US$ 1,00 foi atingido. Nada foi enviado ao provedor.',
        retryable: true,
      },
      402,
    );
    renderAction();

    await userEvent.setup().click(screen.getByRole('button', { name: /Executar/i }));

    expect(await screen.findByText(/teto diário de US\$ 1,00 foi atingido/i)).toBeInTheDocument();
  });

  it('não aplica nada na tela sem clique no botão de aplicar', async () => {
    stubFetch(aiResult());
    const { onApply } = renderAction();

    await userEvent.setup().click(screen.getByRole('button', { name: /Executar/i }));

    const aplicar = await screen.findByRole('button', { name: /Usar na tela/i });
    // Chegou o resultado, e ainda assim nada foi aplicado: aplicar é ato humano.
    expect(onApply).not.toHaveBeenCalled();

    await userEvent.setup().click(aplicar);
    expect(onApply).toHaveBeenCalledTimes(1);
  });
});
