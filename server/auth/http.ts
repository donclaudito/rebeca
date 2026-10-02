/**
 * Rotas de autenticação — as **duas** que não passam pela guarda de lista de acesso.
 *
 * `GET /api/auth/config` é pública por necessidade: o navegador precisa saber o Client ID para
 * renderizar o botão do Google, e o Client ID é público por definição (é o `aud` que o servidor
 * confere). Ela não revela nada além disso — a lista de `sub`s nunca sai daqui.
 *
 * `GET /api/auth/me` exige token válido mas **não** exige estar na lista: é por ela que o dono
 * descobre o próprio `sub` para configurar `REBECA_ALLOWED_SUBS`. Sem essa porta, o primeiro acesso
 * seria um ciclo fechado — para entrar era preciso já estar autorizado.
 *
 * A lógica de verificação não mora aqui: é `server/auth/guard.ts`, a mesma que protege as rotas que
 * gastam dinheiro. Duas implementações de "verificar token" divergiriam, e a divergente seria a que
 * ninguém testou.
 */

import { AUTH_BASE, type AuthMeView } from '../../src/auth/contract.js';
import { allowedSubs, isSubAllowed } from './access.js';
import { authConfigView } from './config.js';
import { authenticateRequest, type AuthContext } from './guard.js';

export interface AuthHttpResult {
  readonly status: number;
  readonly body: unknown;
}

function fail(status: number, code: string, message: string, retryable = false): AuthHttpResult {
  return { status, body: { code, message, retryable } };
}

function metodoNaoPermitido(verb: string): AuthHttpResult {
  return fail(405, 'metodo-nao-permitido', `Esta rota de autenticação responde apenas a GET; recebi ${verb}.`);
}

/** Roteia um pedido de autenticação. É o único ponto que decide o que existe nesta API. */
export async function routeAuthRequest(
  method: string,
  pathname: string,
  context: AuthContext = {},
): Promise<AuthHttpResult> {
  const verb = method.toUpperCase();

  if (pathname === `${AUTH_BASE}/config`) {
    if (verb !== 'GET') return metodoNaoPermitido(verb);
    return { status: 200, body: authConfigView() };
  }

  if (pathname === `${AUTH_BASE}/me`) {
    if (verb !== 'GET') return metodoNaoPermitido(verb);

    const autenticacao = await authenticateRequest(context);
    if (!autenticacao.ok) return { status: autenticacao.status, body: autenticacao.body };

    const lista = allowedSubs();
    const view: AuthMeView = {
      authorized: isSubAllowed(autenticacao.identity.sub, lista),
      identity: autenticacao.identity,
      allowedIdentities: lista.size,
    };
    return { status: 200, body: view };
  }

  return fail(404, 'rota-desconhecida', `Rota de autenticação desconhecida: ${pathname}.`);
}
