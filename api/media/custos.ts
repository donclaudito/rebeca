/**
 * Função serverless da Vercel: `GET /api/media/custos?channelId=<canal>&contentId=<conteúdo>`.
 *
 * Devolve o gasto **real** de um conteúdo, somado do livro de custos — não a estimativa, não o valor do
 * dado de exemplo. A tela de Revisão mostrava "Custo real US$ 42,80" vindo do arquivo de exemplo enquanto
 * o livro somava US$ 0,3956; esta rota é o conserto.
 *
 * A lógica não mora aqui: é `server/media/http.ts`, a mesma função que o servidor de desenvolvimento
 * executa. Este arquivo só liga a tomada (e o import leva `.js` — ver
 * `src/__tests__/serverless-imports.test.ts`, que existe por causa do 500 que a falta de extensão causou
 * em produção).
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { routeMediaRequest, sendMediaResult } from '../../server/media/http.js';

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const result = await routeMediaRequest(req.method ?? 'GET', url.pathname, url.searchParams, undefined, {
    authorization: req.headers.authorization ?? null,
  });
  sendMediaResult(res, result);
}
