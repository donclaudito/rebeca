/**
 * Função serverless da Vercel: `GET /api/auth/me`.
 *
 * Devolve a identidade de quem apresentou o token **e** se ela está na lista de acesso. Exige token
 * válido (401 sem ele) mas não exige estar autorizado — é justamente por aqui que o dono descobre o
 * próprio `sub` para colocar em `REBECA_ALLOWED_SUBS`. Nunca devolve dado de terceiros: só a
 * identidade do próprio token apresentado.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { routeAuthRequest } from '../../server/auth/http.js';

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const result = await routeAuthRequest(req.method ?? 'GET', '/api/auth/me', {
    authorization: req.headers.authorization ?? null,
  });

  res.statusCode = result.status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(result.body ?? {}));
}
