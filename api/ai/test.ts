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
import { readJsonBody, routeAiRequest, sendJson } from '../../server/ai/http';

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const body = await readJsonBody(req);
    const result = await routeAiRequest('POST', '/api/ai/test', body);
    sendJson(res, result.status, result.body);
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message.slice(0, 300)
        : 'Não foi possível ler o pedido de teste.';
    sendJson(res, 400, { code: 'entrada-invalida', message, retryable: false });
  }
}
