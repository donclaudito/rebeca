/**
 * Cliente das rotas de autenticação no navegador.
 *
 * São duas, e cada uma responde a uma pergunta diferente:
 *
 * - `GET /api/auth/config` — **existe com o que entrar?** Devolve o Client ID público (ou `null`,
 *   quando o servidor não tem `GOOGLE_CLIENT_ID`). É pública: o navegador precisa dela antes de ter
 *   qualquer token.
 * - `GET /api/auth/me` — **quem sou eu, e eu posso usar?** Exige o token. `authorized: false` é
 *   resposta legítima: significa que a conta entrou no Google mas ainda não está na lista de acesso.
 *
 * O tratamento de erro copia de propósito o de `src/ai/client.ts`, porque o defeito que ele cobre já
 * aconteceu de verdade: se o servidor de desenvolvimento for iniciado antes de a rota existir, o
 * caminho cai no fallback de SPA e devolve **HTML com status 200**. Sem a checagem, a tela concluiria
 * que a autenticação não existe — e o dono ficaria sem entender por que o botão não aparece.
 */

import { AUTH_BASE, type AuthConfigView, type AuthMeView } from './contract';

/** Erro de autenticação com motivo em pt-BR, pronto para a tela exibir. */
export class AuthRequestError extends Error {
  readonly code: string;
  readonly status: number;
  readonly retryable: boolean;

  constructor(code: string, message: string, status: number, retryable = false) {
    super(message);
    this.name = 'AuthRequestError';
    this.code = code;
    this.status = status;
    this.retryable = retryable;
  }
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${AUTH_BASE}${path}`, {
      ...init,
      headers: { accept: 'application/json', ...(init?.headers ?? {}) },
    });
  } catch {
    throw new AuthRequestError(
      'rede',
      'Não foi possível alcançar o servidor do app. Verifique a conexão e tente de novo.',
      0,
      true,
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

  if (!response.ok) {
    const record = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
    const message =
      typeof record['message'] === 'string'
        ? record['message']
        : 'A autenticação não respondeu como esperado neste ambiente.';
    const code = typeof record['code'] === 'string' ? record['code'] : 'autenticacao';
    throw new AuthRequestError(code, message, response.status, response.status >= 500);
  }

  if (!parsed) {
    const looksLikeHtml = response.headers.get('content-type')?.includes('text/html') ?? false;
    throw new AuthRequestError(
      'sem-json',
      looksLikeHtml
        ? 'O endereço de autenticação respondeu com a página do app em vez de dados. Isso normalmente significa que o servidor está rodando uma versão anterior às rotas de autenticação — pare o servidor e rode `pnpm dev` de novo, então recarregue a página.'
        : 'O servidor respondeu em um formato que o app não entende.',
      200,
      true,
    );
  }

  return body as T;
}

/** O que o servidor oferece para entrar. Nunca traz a lista de identidades autorizadas. */
export function fetchAuthConfig(): Promise<AuthConfigView> {
  return requestJson<AuthConfigView>('/config');
}

/**
 * A identidade do token apresentado.
 *
 * Lança `AuthRequestError` com `status: 401` quando a credencial não vale — o chamador trata isso
 * como sessão inválida, não como falha de produto.
 */
export function fetchMe(token: string): Promise<AuthMeView> {
  return requestJson<AuthMeView>('/me', { headers: { authorization: `Bearer ${token}` } });
}
