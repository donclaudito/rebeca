/**
 * Regressão dos **dois avisos que apareceram no console do navegador do dono**, em 2026-10-02:
 *
 *     [GSI_LOGGER]: google.accounts.id.initialize() is called multiple times. This could cause
 *     unexpected behavior and only the last initialized instance will be used.
 *
 * O `StrictMode` do React 19 (padrão do `main.tsx`) monta, desmonta e remonta cada efeito. Sem
 * guarda, a tela de entrada chamava `initialize` duas vezes por abertura — o que o próprio Google
 * descreve como "comportamento inesperado" — e desenhava o botão duas vezes no mesmo contêiner,
 * porque `renderButton` **acrescenta** um iframe em vez de substituir.
 *
 * Este arquivo não depende do script do Google nem de rede: ele injeta um `window.google` falso e
 * observa as chamadas. É o único jeito de medir isso sem navegador de verdade.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderGoogleButton, resetGoogleInitForTests } from '../google';

const CLIENTE = 'teste.apps.googleusercontent.com';

interface Espiao {
  readonly initialize: ReturnType<typeof vi.fn>;
  readonly renderButton: ReturnType<typeof vi.fn>;
  readonly disableAutoSelect: ReturnType<typeof vi.fn>;
}

/** Instala um `window.google` falso cujo `renderButton` **acrescenta** um filho, como o real. */
function googleFalso(): Espiao {
  const espiao: Espiao = {
    initialize: vi.fn(),
    disableAutoSelect: vi.fn(),
    renderButton: vi.fn((parent: HTMLElement) => {
      const botao = document.createElement('iframe');
      botao.setAttribute('data-fake-button', '1');
      parent.append(botao);
    }),
  };
  (window as unknown as { google: unknown }).google = { accounts: { id: espiao } };
  return espiao;
}

let container: HTMLDivElement;

beforeEach(() => {
  resetGoogleInitForTests();
  container = document.createElement('div');
  document.body.append(container);
});

afterEach(() => {
  resetGoogleInitForTests();
  container.remove();
  delete (window as unknown as { google?: unknown }).google;
  vi.restoreAllMocks();
});

describe('o botão do Google sobrevive à remontagem do React', () => {
  it('initialize é chamado UMA vez por cliente, mesmo com a tela montando de novo', async () => {
    const api = googleFalso();
    const handlers = { onCredential: vi.fn(), onError: vi.fn() };

    // Primeira montagem, desmontagem e segunda montagem — o que o StrictMode faz em desenvolvimento.
    await renderGoogleButton(container, CLIENTE, handlers);
    await renderGoogleButton(container, CLIENTE, handlers);
    await renderGoogleButton(container, CLIENTE, handlers);

    expect(api.initialize).toHaveBeenCalledTimes(1);
    expect(api.initialize.mock.calls[0]?.[0]).toMatchObject({ client_id: CLIENTE, auto_select: false });
    // E o botão é redesenhado a cada montagem (o contêiner é reaproveitado).
    expect(api.renderButton).toHaveBeenCalledTimes(3);
  });

  it('o contêiner NÃO acumula botões quando a tela remonta', async () => {
    googleFalso();
    const handlers = { onCredential: vi.fn(), onError: vi.fn() };

    await renderGoogleButton(container, CLIENTE, handlers);
    await renderGoogleButton(container, CLIENTE, handlers);

    // Sem o `replaceChildren()`, aqui haveria dois iframes sobrepostos.
    expect(container.querySelectorAll('[data-fake-button]')).toHaveLength(1);
  });

  it('o callback único entrega a credencial aos handlers MAIS RECENTES', async () => {
    const api = googleFalso();
    const primeiro = { onCredential: vi.fn(), onError: vi.fn() };
    const segundo = { onCredential: vi.fn(), onError: vi.fn() };

    await renderGoogleButton(container, CLIENTE, primeiro);
    await renderGoogleButton(container, CLIENTE, segundo);

    // O GSI guarda o callback da **primeira** inicialização; ele precisa consultar o estado atual —
    // senão a tela remontada receberia a credencial num handler morto.
    const config = api.initialize.mock.calls[0]?.[0] as { callback: (r: { credential?: string }) => void };
    config.callback({ credential: 'token-novo' });

    expect(primeiro.onCredential).not.toHaveBeenCalled();
    expect(segundo.onCredential).toHaveBeenCalledWith('token-novo');
  });

  it('trocar de cliente inicializa de novo (configuração diferente, página a mesma)', async () => {
    const api = googleFalso();
    const handlers = { onCredential: vi.fn(), onError: vi.fn() };

    await renderGoogleButton(container, CLIENTE, handlers);
    await renderGoogleButton(container, 'outro-cliente.apps.googleusercontent.com', handlers);

    expect(api.initialize).toHaveBeenCalledTimes(2);
  });

  it('credencial vazia vira erro na tela, não uma sessão sem identidade', async () => {
    const api = googleFalso();
    const handlers = { onCredential: vi.fn(), onError: vi.fn() };

    await renderGoogleButton(container, CLIENTE, handlers);
    const config = api.initialize.mock.calls[0]?.[0] as { callback: (r: { credential?: string }) => void };
    config.callback({});

    expect(handlers.onCredential).not.toHaveBeenCalled();
    expect(handlers.onError).toHaveBeenCalledOnce();
  });
});
