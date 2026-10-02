/**
 * Cliente da camada de IA no navegador.
 *
 * O navegador **não** conhece provedor, modelo nem chave. Ele manda `functionId + channelId + input`
 * e recebe o resultado já validado, com o custo real. Toda a decisão de "qual LLM" fica no servidor
 * (`server/ai/handler.ts`), que é o que torna o invariante nº 7 verdadeiro na prática e não só no
 * documento.
 */

import { AiError, type AiErrorBody, type AiRequest, type AiResult, type AiSettingsPatch, type AiSettingsSaveResult, type AiSettingsView, type AiStatus, type ProviderTestResult } from './contract';
import { notifySessionLost, requireAuthHeaders } from '../auth/token';

const BASE = '/api/ai';

/** Erro de sessão: a tela manda entrar de novo, e diz que **nada** foi gerado. */
function erroDeSessao(message: string, status: number): AiError {
  return new AiError({ code: 'nao-autorizado', message, retryable: false }, status);
}

/** Mensagem em pt-BR vinda do corpo do erro, com um texto de reserva. */
function mensagemDoCorpo(body: unknown, reserva: string): string {
  const record = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
  return typeof record['message'] === 'string' ? record['message'] : reserva;
}

/** Converte uma resposta de erro do servidor no `AiError` do domínio. */
function toAiError(status: number, body: unknown): AiError {
  const record = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
  const code = typeof record['code'] === 'string' ? record['code'] : 'provedor';
  const message =
    typeof record['message'] === 'string'
      ? record['message']
      : 'Não foi possível falar com a camada de IA. Nada foi gerado.';
  const detail = typeof record['detail'] === 'string' ? record['detail'] : undefined;
  const retryable = record['retryable'] === true;

  return new AiError(
    detail === undefined
      ? { code: code as AiErrorBody['code'], message, retryable }
      : { code: code as AiErrorBody['code'], message, detail, retryable },
    status,
  );
}

/**
 * Requisição autenticada.
 *
 * O cabeçalho `Authorization` entra em **um** lugar (aqui), não em cada função: são oito chamadas
 * nesta camada, e a que esquecesse o header viraria um 401 no meio do fluxo — com o usuário logado,
 * olhando para uma tela que diz que ele não está.
 */
async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  let headers: Record<string, string>;
  try {
    headers = {
      'content-type': 'application/json',
      ...requireAuthHeaders(),
      ...((init?.headers as Record<string, string> | undefined) ?? {}),
    };
  } catch {
    // Sem sessão o pedido **não sai**: mandar anônimo só produziria 401 e uma mensagem pior.
    throw erroDeSessao(
      'Sua sessão terminou. Entre de novo com a sua conta Google para continuar. Nada foi gerado.',
      401,
    );
  }

  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, { ...init, headers });
  } catch {
    // Erro de rede: a mensagem não acusa o usuário nem sugere que o conteúdo foi gerado.
    throw new AiError(
      {
        code: 'provedor',
        message: 'Não foi possível alcançar o servidor do app. Verifique a conexão e tente de novo.',
        retryable: true,
      },
      0,
    );
  }

  let body: unknown = null;
  let parsed = false;
  try {
    body = await response.json();
    parsed = true;
  } catch {
    parsed = false;
  }

  /*
   * 401 e 403 são tratados antes do erro genérico porque a ação de quem está na tela é diferente:
   * 401 é "entre de novo" (a credencial expirou — a sessão em memória é descartada aqui, no único
   * ponto por onde todas as chamadas passam); 403 é "esta conta não tem acesso", e a sessão continua
   * válida — derrubá-la obrigaria a entrar de novo para receber o mesmo 403.
   */
  if (response.status === 401 || response.status === 403) {
    if (response.status === 401) notifySessionLost();
    throw erroDeSessao(
      mensagemDoCorpo(
        body,
        response.status === 401
          ? 'Sua credencial não foi aceita. Entre de novo com a sua conta Google. Nada foi gerado.'
          : 'Esta conta não tem acesso a esta operação.',
      ),
      response.status,
    );
  }

  if (!response.ok) throw toAiError(response.status, body);

  /*
   * Resposta 200 que **não é JSON**.
   *
   * Acontece de verdade: se o servidor de desenvolvimento foi iniciado antes de as rotas de IA
   * existirem, `/api/ai/...` não é atendido pelo middleware e cai no fallback de SPA do Vite, que
   * devolve o `index.html` com status 200. Sem esta checagem, `body` virava `null`, a tela mostrava
   * "não foi possível carregar" **sem dizer por quê** — e o usuário concluía que a IA não funciona.
   * Foi exatamente o sintoma relatado: o painel sem modelos e o botão de teste sem resposta.
   *
   * A mensagem diz o que fazer, porque o diagnóstico não é adivinhável a partir da tela.
   */
  if (!parsed) {
    const looksLikeHtml =
      response.headers.get('content-type')?.includes('text/html') ?? false;
    throw new AiError(
      {
        code: 'provedor',
        message: looksLikeHtml
          ? 'O endereço de IA respondeu com a página do app em vez de dados. Isso normalmente significa que o servidor está rodando uma versão anterior às rotas de IA — pare o servidor e rode `pnpm dev` de novo, então recarregue a página.'
          : 'O servidor respondeu em um formato que o app não entende. Nada foi gerado.',
        detail: `GET/POST ${path} devolveu ${response.status} sem JSON`,
        retryable: true,
      },
      502,
    );
  }

  return body as T;
}

/** Estado do provedor: quem está configurado, qual modelo atende cada função e o teto em vigor. */
export function fetchAiStatus(): Promise<AiStatus> {
  return requestJson<AiStatus>('/status');
}

/** Executa uma função de IA. O `channelId` vai sempre no corpo — não existe chamada sem canal. */
export function generate(request: AiRequest): Promise<AiResult> {
  return requestJson<AiResult>('/generate', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

/* =============================================================================
   Configuração: segredos, endereços e escolha de modelo
   ============================================================================= */

/** Lê a configuração. A resposta **nunca** traz valor de chave — só máscara e presença. */
export function fetchSettings(): Promise<AiSettingsView> {
  return requestJson<AiSettingsView>('/settings');
}

/**
 * Grava a configuração.
 *
 * Sobre `apiKey`: omitir o campo **preserva** a chave atual; enviar `null` **remove**. Essa distinção
 * é o que permite a tela mostrar um campo de chave vazio (porque o valor nunca chega ao navegador)
 * sem apagar a chave a cada salvamento.
 */
export function saveSettings(patch: AiSettingsPatch): Promise<AiSettingsSaveResult> {
  return requestJson<AiSettingsSaveResult>('/settings', {
    method: 'PUT',
    body: JSON.stringify(patch),
  });
}

/**
 * Testa a conexão de um provedor com uma chamada mínima real.
 *
 * `apiKey` é a chave **digitada na tela e ainda não salva**. O painel promete o fluxo colar → testar
 * → salvar e habilita o botão assim que o campo tem algo; sem enviar a chave, o botão testava só o
 * que já estava gravado e quem colava uma chave nova recebia "não há chave cadastrada" — com a chave
 * na frente. O servidor usa esse valor e o descarta: não grava nada (e recusa chave vinda do
 * navegador em ambiente publicado).
 */
export function testProvider(provider: string, apiKey?: string): Promise<ProviderTestResult> {
  const body = apiKey && apiKey.length > 0 ? { provider, apiKey } : { provider };
  return requestJson<ProviderTestResult>('/test', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export { AiError };
export type { AiResult, AiStatus, AiRequest, AiSettingsPatch, AiSettingsSaveResult, AiSettingsView, ProviderTestResult };
