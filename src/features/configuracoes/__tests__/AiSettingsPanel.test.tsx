/**
 * Teste de tela do painel de configuração de IA.
 *
 * Existe por causa de um relato concreto: **"não aparecem os modelos"**. Sem teste de render, não
 * havia como distinguir três causas possíveis — (a) o painel não monta, (b) o seletor fica vazio, ou
 * (c) a resposta do servidor não chegou e a tela caiu no estado de erro. Este arquivo responde às
 * três, e é o teste que faltava quando o painel foi entregue.
 *
 * A rede é substituída: nenhum teste aqui toca um provedor pago.
 */

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AiSettingsPanel } from '../AiSettingsPanel';
import type { AiSettingsView } from '@/ai/contract';

/* --- resposta do servidor, com a forma real --------------------------------- */

const CATALOG = [
  { spec: 'openai:gpt-6.1-sol', provider: 'openai', model: 'gpt-6.1-sol', label: 'GPT-6.1 Sol', inputUsdPerMillion: 2, outputUsdPerMillion: 10, minorPolicy: 'permitido' as const, allowsChildChannel: true },
  { spec: 'openai:gpt-6-luna', provider: 'openai', model: 'gpt-6-luna', label: 'GPT-6 Luna', inputUsdPerMillion: 0.1, outputUsdPerMillion: 0.5, minorPolicy: 'permitido' as const, allowsChildChannel: true },
  { spec: 'anthropic:claude-opus-5-5', provider: 'anthropic', model: 'claude-opus-5-5', label: 'Claude Opus 5.5', inputUsdPerMillion: 4, outputUsdPerMillion: 20, minorPolicy: 'permitido' as const, allowsChildChannel: true },
  { spec: 'google:gemini-3.8-flash', provider: 'google', model: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash', inputUsdPerMillion: 0.75, outputUsdPerMillion: 3.75, minorPolicy: 'restrito-menores' as const, allowsChildChannel: false },
];

function settingsView(overrides: Partial<AiSettingsView> = {}): AiSettingsView {
  return {
    writable: true,
    hosted: false,
    durable: true,
    configPath: '.rebeca/segredos/llm.json',
    envVars: ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'DEEPSEEK_API_KEY', 'GEMINI_API_KEY', 'OPENROUTER_API_KEY'],
    updatedBy: null,
    providers: [
      { provider: 'openai', envVar: 'OPENAI_API_KEY', configured: true, keyMask: '••••I9QA', keySource: 'configuracao', baseUrl: 'https://api.openai.com/v1/chat/completions', defaultBaseUrl: 'https://api.openai.com/v1/chat/completions', baseUrlCustomized: false, minorPolicy: 'permitido', allowedForChildDirected: true },
      { provider: 'anthropic', envVar: 'ANTHROPIC_API_KEY', configured: false, keyMask: '', keySource: 'ausente', baseUrl: 'https://api.anthropic.com/v1/messages', defaultBaseUrl: 'https://api.anthropic.com/v1/messages', baseUrlCustomized: false, minorPolicy: 'permitido', allowedForChildDirected: true },
      { provider: 'google', envVar: 'GEMINI_API_KEY', configured: false, keyMask: '', keySource: 'ausente', baseUrl: 'https://generativelanguage.googleapis.com/v1beta', defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta', baseUrlCustomized: false, minorPolicy: 'restrito-menores', allowedForChildDirected: false },
    ],
    tiers: [
      { tier: 'raciocinio', label: 'Raciocínio e análise', purpose: 'Revisar, comparar, planejar e julgar.', override: null, resolved: 'openai:gpt-6.1-sol' },
      { tier: 'criativo', label: 'Escrita e criação', purpose: 'Escrever roteiro, cena e personagem.', override: null, resolved: 'openai:gpt-6.1-sol' },
      { tier: 'rapido', label: 'Tarefas rápidas e baratas', purpose: 'Extrair, classificar e formatar.', override: null, resolved: 'openai:gpt-6-luna' },
      { tier: 'visao', label: 'Leitura de imagem', purpose: 'Ler imagem.', override: null, resolved: 'openai:gpt-6-luna' },
    ],
    functions: [
      { functionId: 'criar-seo', label: 'Preparar título, descrição e tags', tier: 'rapido', resolved: 'openai:gpt-6-luna', source: 'catalogo' },
      { functionId: 'revisar-qualidade', label: 'Revisar a qualidade', tier: 'raciocinio', resolved: 'openai:gpt-6.1-sol', source: 'catalogo' },
    ],
    flags: { allowUnverifiedMinorPolicy: false, allowUnpricedModel: false, allowNoLedger: false },
    catalog: CATALOG,
    updatedAt: '2026-10-01T20:00:00.000Z',
    ledger: 'csv',
    ...overrides,
  };
}

function stubSettings(payload: unknown, status = 200) {
  // Responde por método: o `PUT` devolve o resultado da gravação, não a configuração. Devolver a
  // forma errada foi o que gerou um "unhandled rejection" no primeiro teste — e obrigou o painel a
  // ganhar uma guarda contra resposta em forma inesperada.
  const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
    const method = (init?.method ?? 'GET').toUpperCase();
    const body =
      method === 'PUT'
        ? { changed: ['nível raciocinio: openai:gpt-6-luna'], updatedAt: '2026-10-01T21:00:00.000Z', settings: payload }
        : payload;
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function renderPanel() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AiSettingsPanel />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('painel de configuração de IA', () => {
  it('monta e mostra os provedores com o estado da chave', async () => {
    stubSettings(settingsView());
    renderPanel();

    expect(await screen.findByText('OpenAI')).toBeInTheDocument();
    expect(screen.getByText('Anthropic (Claude)')).toBeInTheDocument();
    expect(screen.getByText('Google (Gemini)')).toBeInTheDocument();
    // A chave aparece mascarada na dica do campo — nunca o valor.
    expect(screen.getByPlaceholderText(/I9QA/)).toBeInTheDocument();
  });

  it('OS MODELOS APARECEM nos seletores de nível', async () => {
    // Este é o teste do relato "não aparecem os modelos".
    stubSettings(settingsView());
    renderPanel();

    const select = (await screen.findByLabelText('Raciocínio e análise')) as HTMLSelectElement;
    const valores = within(select)
      .getAllByRole('option')
      .map((option) => (option as HTMLOptionElement).value);

    expect(valores).toContain('openai:gpt-6.1-sol');
    expect(valores).toContain('openai:gpt-6-luna');
    expect(valores).toContain('anthropic:claude-opus-5-5');
    expect(valores).toContain('google:gemini-3.8-flash');
    // A opção de "não sobrepor" tem de existir para o usuário voltar ao padrão.
    expect(valores).toContain('');
  });

  it('o seletor mostra o endereço padrão de TODOS os provedores, inclusive Anthropic e Google', async () => {
    // Defeito real: a tela mostrava o campo vazio para esses dois, porque o mapa de endereços só
    // cobria os três provedores do dialeto `chat/completions`.
    stubSettings(settingsView());
    renderPanel();

    expect((await screen.findAllByLabelText('Endereço do provedor')).length).toBe(3);
    const campos = screen.getAllByLabelText('Endereço do provedor') as HTMLInputElement[];
    for (const campo of campos) {
      expect(campo.value.length).toBeGreaterThan(0);
      expect(campo.placeholder.length).toBeGreaterThan(0);
    }
  });

  it('lista as funções com o modelo que atende cada uma', async () => {
    stubSettings(settingsView());
    renderPanel();

    await screen.findByText('OpenAI');
    // A seção por função é recolhida; o conteúdo precisa existir ao expandir.
    const resumo = screen.getByText(/Modelo por função/i);
    await userEvent.setup().click(resumo);

    expect(await screen.findByText('Preparar título, descrição e tags')).toBeInTheDocument();
    expect(screen.getByText('Revisar a qualidade')).toBeInTheDocument();
  });

  it('quando o servidor devolve HTML, explica o que fazer em vez de carregar para sempre', async () => {
    /*
     * Regressão do defeito que o dono do produto relatou: "testei e não funcionou, e não aparecem os
     * modelos". A causa não estava na chamada ao provedor — o painel ficava preso no esqueleto de
     * carregamento, porque a verificação de erro vinha DEPOIS da de carregamento e o rascunho só
     * nasce quando a resposta chega. Resultado: nem modelos, nem erro, nem pista.
     */
    const fetchMock = vi.fn(async () =>
      new Response('<!doctype html><html><body>app</body></html>', {
        status: 200,
        headers: { 'content-type': 'text/html' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    renderPanel();

    // Tem de SAIR do carregamento e dizer o que houve.
    expect(await screen.findByText(/rodando uma versão anterior/i, undefined, { timeout: 8000 })).toBeInTheDocument();
  });

  it('em ambiente publicado, avisa que não dá para gravar e não oferece os campos', async () => {
    stubSettings(settingsView({ writable: false, hosted: true, configPath: null }));
    renderPanel();

    expect(await screen.findByText(/publicado/i)).toBeInTheDocument();
    expect(screen.getByText(/gerenciador de segredos/i)).toBeInTheDocument();

    const campoChave = screen.getAllByLabelText('Chave de API')[0] as HTMLInputElement;
    expect(campoChave).toBeDisabled();
  });

  it('em app publicado, o campo explica por que está desativado em vez de convidar a colar', async () => {
    /*
     * Relato do dono, literal: "os provedores não aceitam colar as api". O comportamento estava
     * certo — campo `disabled`, porque rota pública que aceita credencial de visitante é
     * vulnerabilidade — mas a tela convidava a uma ação impossível: o campo vazio dizia "cole a chave
     * aqui" e o motivo ficava num parágrafo pequeno acima. Este teste exige as duas coisas: o motivo
     * junto dos campos e o caminho que de fato funciona, escrito na tela.
     */
    stubSettings(settingsView({ writable: false, hosted: true, configPath: null }));
    renderPanel();

    expect(await screen.findByText(/não pode ser colada aqui/i)).toBeInTheDocument();
    // O caminho que funciona: o app local, onde o mesmo painel é editável.
    expect(screen.getByText('pnpm dev')).toBeInTheDocument();
    expect(screen.getByText('localhost:5173')).toBeInTheDocument();

    const campos = screen.getAllByLabelText('Chave de API') as HTMLInputElement[];
    expect(campos.length).toBeGreaterThan(0);
    for (const campo of campos) {
      expect(campo).toBeDisabled();
      // O campo não pode convidar a uma ação que a tela não permite.
      expect(campo.placeholder).toMatch(/não editável/i);
      expect(campo.placeholder).not.toMatch(/cole a chave/i);
    }
  });

  it('em ambiente local, o campo convida a colar a chave e não mostra o aviso de somente leitura', async () => {
    // A outra face da moeda: o conserto do aviso não pode matar o caminho editável.
    stubSettings(settingsView());
    renderPanel();

    expect(await screen.findByText('OpenAI')).toBeInTheDocument();
    expect(screen.queryByText(/não pode ser colada aqui/i)).not.toBeInTheDocument();

    const campos = screen.getAllByLabelText('Chave de API') as HTMLInputElement[];
    const semChave = campos[1]; // Anthropic, sem chave neste cenário
    expect(semChave).toBeEnabled();
    expect(semChave?.placeholder).toBe('cole a chave aqui');
  });

  it('salvar envia apenas o que mudou, e não apaga a chave quando o campo fica vazio', async () => {
    const fetchMock = stubSettings(settingsView());
    renderPanel();

    const select = (await screen.findByLabelText('Raciocínio e análise')) as HTMLSelectElement;
    await userEvent.setup().selectOptions(select, 'openai:gpt-6-luna');

    const salvar = screen.getByRole('button', { name: /Salvar configuração/i });
    await waitFor(() => expect(salvar).toBeEnabled());
    await userEvent.setup().click(salvar);

    const saveCall = fetchMock.mock.calls.find(
      (call) => (call[1] as RequestInit | undefined)?.method === 'PUT',
    );
    expect(saveCall).toBeTruthy();
    const body = JSON.parse(String((saveCall?.[1] as RequestInit).body)) as Record<string, unknown>;

    expect(body['models']).toEqual({ raciocinio: 'openai:gpt-6-luna' });
    // O campo de chave estava vazio (a tela nunca recebe o valor): não pode virar `apiKey: null`.
    const providers = body['providers'] as Record<string, Record<string, unknown>> | undefined;
    expect(providers?.['openai']?.apiKey).toBeUndefined();
  });

  it('testar conexão envia a chave DIGITADA, e não só a que já está salva', async () => {
    /*
     * Relato do dono, literal: "colei a API e nada". Com a chave no campo, o servidor respondia "não
     * há chave cadastrada para este provedor" — porque o teste mandava apenas `{ provider }` e a
     * credencial era resolvida só do que já estava gravado. O fluxo prometido pelo painel é
     * colar → testar → salvar; a asserção aqui é sobre o corpo enviado.
     */
    const fetchMock = stubSettings(settingsView());
    renderPanel();

    const campos = (await screen.findAllByLabelText('Chave de API')) as HTMLInputElement[];
    const anthropic = campos[1];
    expect(anthropic).toBeDefined();
    await userEvent.setup().type(anthropic as HTMLInputElement, 'chave-colada-na-tela-0001');

    const botoes = screen.getAllByRole('button', { name: /Testar conexão/i });
    await userEvent.setup().click(botoes[1] as HTMLElement);

    await waitFor(() => {
      expect(fetchMock.mock.calls.some((call) => String(call[0]).includes('/test'))).toBe(true);
    });

    const testCall = fetchMock.mock.calls.find((call) => String(call[0]).includes('/test'));
    const body = JSON.parse(String((testCall?.[1] as RequestInit).body)) as Record<string, unknown>;
    expect(body).toEqual({ provider: 'anthropic', apiKey: 'chave-colada-na-tela-0001' });
  });
});
