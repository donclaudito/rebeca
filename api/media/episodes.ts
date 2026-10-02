/**
 * Função serverless da Vercel: `GET /api/media/episodes?channelId=<canal>`.
 *
 * Devolve o que o pipeline gerou para o canal — ou, quando não há nada, `available: false` **com o
 * motivo**. A distinção existe porque lista vazia sem explicação é indistinguível de defeito: o dono do
 * produto já viu esse filme quando o app mostrava "nenhum vídeo foi gerado ainda" enquanto os arquivos
 * estavam no disco.
 *
 * A lógica não mora aqui: é `server/media/http.ts`, a mesma função que o servidor de desenvolvimento
 * executa. Este arquivo só liga a tomada (e o import leva `.js` — ver o teste
 * `src/__tests__/serverless-imports.test.ts`, que existe por causa do 500 que a falta de extensão
 * causou em produção).
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
