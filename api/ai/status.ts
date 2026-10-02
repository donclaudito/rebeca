/**
 * Função serverless da Vercel: `GET /api/ai/status`.
 *
 * Diz ao app, sem revelar nenhuma chave, quais fornecedores estão configurados, qual modelo atende
 * cada função e qual é o teto de gasto em vigor. É o que permite a tela de Configurações dizer a
 * verdade em vez de o usuário descobrir na tentativa e erro.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { routeAiRequest, sendJson } from '../../server/ai/http.js';

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  // GET não tem corpo: a função devolve `undefined` — o roteador nunca a chama nesta rota.
  const result = await routeAiRequest('GET', '/api/ai/status', async () => undefined, {
    authorization: req.headers.authorization ?? null,
  });
  sendJson(res, result.status, result.body);
}
