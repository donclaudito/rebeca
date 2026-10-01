/**
 * Função serverless da Vercel: `POST /api/ai/generate`.
 *
 * Por que a chamada de IA **não** sai do navegador: a chave do provedor ficaria visível para
 * qualquer visitante da página, e uma chave de LLM é gasto direto na conta do dono do produto. A
 * skill `rebeca-seguranca` é explícita — segredo nunca no client. Aqui a chave vive só no ambiente
 * do servidor, e o navegador recebe o resultado já validado.
 *
 * Esta função é uma casca fina de propósito: toda a lógica está em `server/ai/http.ts`, que é a
 * **mesma** que o servidor de desenvolvimento usa. Casca fina com lógica duplicada é como se cria
 * "funciona na minha máquina".
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { readJsonBody, routeAiRequest, sendJson } from '../../server/ai/http.js';

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const body = await readJsonBody(req);
    const result = await routeAiRequest('POST', '/api/ai/generate', body);
    sendJson(res, result.status, result.body);
  } catch (error) {
    // `readJsonBody` pode lançar antes de existir rota; nada aqui carrega segredo.
    const message =
      error instanceof Error && error.name === 'AiError'
        ? error.message
        : 'Não foi possível ler o pedido. Nada foi gerado.';
    sendJson(res, 400, { code: 'entrada-invalida', message, retryable: false });
  }
}
