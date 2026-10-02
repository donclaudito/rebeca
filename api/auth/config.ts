/**
 * Função serverless da Vercel: `GET /api/auth/config`.
 *
 * Diz ao navegador qual Client ID usar no botão do Google e quantas identidades estão autorizadas.
 * **É pública de propósito** — o Client ID não é segredo (vai no bundle do navegador e é o `aud` que o
 * servidor confere) e o navegador precisa dele antes de ter qualquer token. A contagem de identidades
 * permite a tela distinguir "você ainda não está autorizado" de "ninguém está autorizado ainda"; a
 * lista em si **nunca** sai daqui.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { routeAuthRequest } from '../../server/auth/http.js';

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const result = await routeAuthRequest(req.method ?? 'GET', '/api/auth/config', {
    authorization: req.headers.authorization ?? null,
  });

  res.statusCode = result.status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(result.body ?? {}));
}
