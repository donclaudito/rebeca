/**
 * Função serverless da Vercel: `POST /api/ai/test`.
 *
 * Testa a conexão de um provedor com uma chamada mínima **real**. É o que transforma "salvei a
 * chave" em "a chave funciona" — sem isso, o usuário só descobre que a chave está errada quando tenta
 * gerar conteúdo de verdade, e culpa o produto.
 *
 * A chamada é curta, passa pelas mesmas travas de custo e o gasto **real** é registrado no livro:
 * teste pago é gasto como qualquer outro.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { readJsonBody, routeAiRequest, sendJson } from '../../server/ai/http.js';

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  // Corpo como função: lido **depois** da guarda (defeito 1 do `QA-014`).
  const result = await routeAiRequest('POST', '/api/ai/test', () => readJsonBody(req), {
    authorization: req.headers.authorization ?? null,
  });
  sendJson(res, result.status, result.body);
}
