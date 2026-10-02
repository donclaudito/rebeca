/**
 * Prova do lado do navegador: o portão fecha, o token fica **em memória**, e o cabeçalho vai em toda
 * chamada que gasta.
 *
 * O que estes testes tentam refutar, em ordem de gravidade:
 *
 * 1. **Que dá para chegar numa tela sem sessão.** Se qualquer rota de `api/ai` ou `api/media` for
 *    chamada antes do login, a chave paga está sendo usada por quem não entrou. A prova é a lista de
 *    URLs chamadas, não a aparência da tela.
 * 2. **Que a credencial fica guardada em algum lugar durável.** `localStorage`/`sessionStorage` são
 *    legíveis por qualquer script da página; o `ADR-014` decidiu memória. Aqui as duas APIs de
 *    armazenamento são espionadas e a asserção é que **não houve escrita**.
 * 3. **Que uma chamada sai sem o cabeçalho.** Um único caminho sem `Authorization` vira um 401 no
 *    meio do fluxo, com o usuário logado olhando para uma tela que diz que ele não está.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { App } from '@/App';
import { AuthProvider, useAuth } from '../context';
import { MediaImage } from '../MediaImage';
import { generate, fetchAiStatus } from '@/ai/client';
import { fetchMediaLibrary } from '@/media/client';
import { getAccessToken, resetSessionForTests, setAccessToken } from '../token';

/* --- Apoio: um `fetch` que responde por rota e registra o que foi pedido ------------- */

interface Chamada {
  readonly url: string;
  readonly init: RequestInit | undefined;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function mockFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>): Chamada[] {
  const chamadas: Chamada[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: unknown, init?: RequestInit) => {
      const url = String(input);
      chamadas.push({ url, init });
      return handler(url, init);
    }),
  );
  return chamadas;
}

function urlsDe(chamadas: readonly Chamada[], prefixo: string): Chamada[] {
  return chamadas.filter((chamada) => chamada.url.startsWith(prefixo));
}

/**
 * A rota **pública** devolve só isto desde o `QA-014`: o Client ID e o endereço da biblioteca. A
 * contagem de identidades autorizadas só sai em `/api/auth/me`, depois de o token ser verificado.
 */
const CONFIG_OK = {
  clientId: '973836082003-teste.apps.googleusercontent.com',
  googleScriptUrl: 'https://accounts.google.com/gsi/client',
};

const CONFIG_SEM_CLIENT_ID = { ...CONFIG_OK, clientId: null };

let escreverEm: string[] = [];

beforeEach(() => {
  resetSessionForTests();
  escreverEm = [];
  // Espiona as duas APIs de armazenamento: qualquer escrita durante o fluxo é defeito.
  for (const storage of ['localStorage', 'sessionStorage'] as const) {
    const original = window[storage].setItem.bind(window[storage]);
    vi.spyOn(window[storage], 'setItem').mockImplementation((chave: string, valor: string) => {
      escreverEm.push(`${storage}:${chave}`);
      original(chave, valor);
    });
  }
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.localStorage.clear();
  window.sessionStorage.clear();
  resetSessionForTests();
});

describe('o portão de entrada', () => {
  it('sem sessão mostra a entrada e NÃO chama nenhuma rota de IA ou de mídia', async () => {
    const chamadas = mockFetch(() => json(CONFIG_OK));

    render(<App />);

    expect(await screen.findByRole('heading', { name: /entrar para continuar/i })).toBeInTheDocument();

    /*
     * A asserção que importa não é a tela: é o que **não** foi chamado. Se qualquer consulta de tela
     * tivesse disparado, o app estaria gastando (ou tentando gastar) antes de alguém provar quem é.
     */
    expect(urlsDe(chamadas, '/api/ai')).toHaveLength(0);
    expect(urlsDe(chamadas, '/api/media')).toHaveLength(0);
    expect(urlsDe(chamadas, '/api/auth/config')).toHaveLength(1);
  });

  it('diz que falta GOOGLE_CLIENT_ID quando o servidor não tem a variável', async () => {
    mockFetch(() => json(CONFIG_SEM_CLIENT_ID));

    render(<App />);

    expect(await screen.findByText(/A autenticação não está configurada/i)).toBeInTheDocument();
    expect(screen.getByText(/GOOGLE_CLIENT_ID/)).toBeInTheDocument();
  });

  it('não confunde falha de leitura com falta de configuração', async () => {
    // "não deu para perguntar" e "falta uma variável no servidor" pedem ações diferentes. O app já
    // pagou caro por misturar as duas uma vez (o painel de IA que carregava para sempre).
    mockFetch(() => json({ code: 'autenticacao', message: 'A autenticação falhou no servidor.' }, 500));

    render(<App />);

    expect(await screen.findByRole('alert')).toHaveTextContent(/A autenticação falhou no servidor/i);
    expect(screen.queryByText(/A autenticação não está configurada/i)).not.toBeInTheDocument();
  });
});

/* --- O fluxo de entrar, sem o script do Google (que não existe em jsdom) -------------- */

function Sonda() {
  const { status, identity, signIn, allowedIdentities } = useAuth();
  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="sub">{identity?.sub ?? '—'}</span>
      <span data-testid="quantas">{allowedIdentities}</span>
      <button type="button" onClick={() => void signIn('token-de-teste')}>
        entrar
      </button>
    </div>
  );
}

describe('a sessão entra em memória e em nenhum outro lugar', () => {
  it('entrar guarda a identidade, marca autorizado e não escreve em storage', async () => {
    const chamadas = mockFetch((url) => {
      if (url.endsWith('/api/auth/config')) return json(CONFIG_OK);
      if (url.endsWith('/api/auth/me')) {
        return json({
          authorized: true,
          identity: { sub: '102938475610293847561', email: 'dono@exemplo.test' },
          allowedIdentities: 1,
        });
      }
      return json({}, 404);
    });

    render(
      <AuthProvider>
        <Sonda />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('anonimo'));
    screen.getByRole('button', { name: 'entrar' }).click();

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('autorizado'));
    expect(screen.getByTestId('sub')).toHaveTextContent('102938475610293847561');

    // Nada de armazenamento durável: era exatamente o que o `ADR-014` proibiu.
    expect(escreverEm).toEqual([]);

    // E o `/me` foi chamado **com** a credencial, não anonimamente.
    const me = chamadas.find((chamada) => chamada.url.endsWith('/api/auth/me'));
    expect((me?.init?.headers as Record<string, string> | undefined)?.['authorization']).toBe(
      'Bearer token-de-teste',
    );
  });

  it('conta autenticada fora da lista vira estado próprio, e não erro', async () => {
    mockFetch((url) => {
      if (url.endsWith('/api/auth/config')) return json(CONFIG_OK);
      return json({
        authorized: false,
        identity: { sub: '998877665544332211000', email: 'estranho@exemplo.test' },
        allowedIdentities: 0,
      });
    });

    render(
      <AuthProvider>
        <Sonda />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('anonimo'));
    screen.getByRole('button', { name: 'entrar' }).click();

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('nao-autorizado'));
    expect(screen.getByTestId('sub')).toHaveTextContent('998877665544332211000');
  });

  it('a credencial recusada pelo servidor não deixa sessão pendurada', async () => {
    mockFetch((url) => {
      if (url.endsWith('/api/auth/config')) return json(CONFIG_OK);
      return json({ code: 'token-invalido', message: 'A credencial não é válida.' }, 401);
    });

    render(
      <AuthProvider>
        <Sonda />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('anonimo'));
    screen.getByRole('button', { name: 'entrar' }).click();

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('anonimo'));
    expect(getAccessToken()).toBeNull();
  });
});

/* --- O cabeçalho nas chamadas que gastam --------------------------------------------- */

describe('o cabeçalho Authorization acompanha as chamadas', () => {
  it('a camada de IA manda o header em toda chamada', async () => {
    const chamadas = mockFetch(() => json({}));
    setAccessToken('token-de-teste');

    await expect(fetchAiStatus()).resolves.toBeDefined();
    await generate({ functionId: 'criar-seo', channelId: 'luna', input: {} }).catch(() => undefined);
    await fetchMediaLibrary('luna').catch(() => undefined);

    for (const chamada of chamadas) {
      const headers = chamada.init?.headers as Record<string, string> | undefined;
      expect(headers?.['authorization'], `sem header em ${chamada.url}`).toBe('Bearer token-de-teste');
    }
    expect(chamadas.length).toBeGreaterThanOrEqual(3);
  });

  it('sem sessão, a chamada nem sai', async () => {
    const chamadas = mockFetch(() => json({}));

    // Cada camada recusa com o **próprio** tipo de erro (a de IA com `AiError`, a de mídia com
    // `MediaReadError`), porque é isso que as telas de cada uma sabem tratar. O que as duas têm em
    // comum, e o que o teste exige, é o essencial: nada foi para a rede.
    await expect(fetchAiStatus()).rejects.toThrow(/sessão terminou/i);
    await expect(fetchMediaLibrary('luna')).rejects.toThrow(/sessão terminou/i);
    expect(chamadas).toHaveLength(0);
  });

  it('401 derruba a sessão em memória', async () => {
    mockFetch(() => json({ code: 'token-invalido', message: 'A credencial expirou.' }, 401));
    setAccessToken('token-vencido');

    await expect(fetchAiStatus()).rejects.toThrow(/credencial expirou/i);
    expect(getAccessToken()).toBeNull();
  });

  it('403 NÃO derruba a sessão — a conta está autenticada, só não tem acesso', async () => {
    const mensagem =
      'A conta estranho@exemplo.test (sub 998877665544332211000) entrou no Google, mas não está na lista de acesso deste app.';
    mockFetch(() => json({ code: 'conta-nao-autorizada', message: mensagem }, 403));
    setAccessToken('token-valido');

    await expect(generate({ functionId: 'criar-seo', channelId: 'luna', input: {} })).rejects.toThrow(
      /não está na lista de acesso/i,
    );
    // A sessão continua: derrubá-la obrigaria a entrar de novo para receber o mesmo 403.
    expect(getAccessToken()).toBe('token-valido');
  });
});

/* --- A imagem autenticada ------------------------------------------------------------ */

describe('a arte é buscada com credencial e exibida de um blob', () => {
  let criadas: string[] = [];
  let revogadas: string[] = [];

  beforeEach(() => {
    criadas = [];
    revogadas = [];
    Object.defineProperty(URL, 'createObjectURL', {
      writable: true,
      configurable: true,
      value: vi.fn(() => {
        const url = `blob:teste-${criadas.length + 1}`;
        criadas.push(url);
        return url;
      }),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      writable: true,
      configurable: true,
      value: vi.fn((url: string) => revogadas.push(url)),
    });
  });

  it('busca com o header, exibe o blob e revoga ao desmontar', async () => {
    setAccessToken('token-de-teste');
    // O `content-type` é declarado **explicitamente** porque desde o `QA-014` ele é condição de
    // sucesso: 200 sem tipo de imagem cai no estado de falha (ver o caso de `text/html`).
    const chamadas = mockFetch(
      () =>
        new Response(new Blob(['arte'], { type: 'image/png' }), {
          status: 200,
          headers: { 'content-type': 'image/png' },
        }),
    );

    const { unmount } = render(
      <MediaImage src="/api/media/file?channelId=luna&episodeId=e&asset=a.png" alt="Prévia de teste" />,
    );

    const imagem = await screen.findByRole('img', { name: 'Prévia de teste' });
    expect(imagem.getAttribute('src')).toBe('blob:teste-1');

    const headers = chamadas[0]?.init?.headers as Record<string, string> | undefined;
    expect(headers?.['authorization']).toBe('Bearer token-de-teste');

    unmount();
    // Sem a revogação, cada blob segura os bytes na memória da aba até a página fechar.
    expect(revogadas).toEqual(['blob:teste-1']);
  });

  it('quando a imagem falha, diz que falhou em vez de mostrar arte que não existe', async () => {
    setAccessToken('token-de-teste');
    mockFetch(() => json({ code: 'arquivo-fora-do-manifesto', message: 'não existe' }, 404));

    render(<MediaImage src="/api/media/file?asset=sumiu.png" alt="Prévia de sumiu" />);

    const aviso = await screen.findByRole('img', { name: /não foi possível carregar/i });
    expect(aviso).toBeInTheDocument();
  });

  it('sem sessão não busca nada e mostra o espaço reservado', async () => {
    const chamadas = mockFetch(() => json({}, 200));

    const { container } = render(<MediaImage src="/api/media/file?asset=a.png" alt="Prévia" />);

    await waitFor(() => expect(container.querySelector('span[role="img"]')).not.toBeNull());
    expect(chamadas).toHaveLength(0);
  });
});
