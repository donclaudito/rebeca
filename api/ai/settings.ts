/**
 * Função serverless da Vercel: `GET`/`PUT /api/ai/settings`.
 *
 * Lê e grava a configuração de IA — chaves, endereços e escolha de modelo.
 *
 * **A leitura nunca devolve valor de chave**: só máscara e indicador de presença. **A gravação é
 * recusada quando o app está publicado** (`settingsWritable()` em `server/ai/secrets.ts`): sem
 * autenticação nesta fase (D3 aberta), uma rota pública que aceita chave de API de qualquer visitante
 * seria uma vulnerabilidade. Em produção, o lugar do segredo é o gerenciador de segredos do servidor.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { readJsonBody, routeAiRequest, sendJson } from '../../server/ai/http';

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const method = (req.method ?? 'GET').toUpperCase();
  try {
    const body = method === 'GET' ? undefined : await readJsonBody(req);
    const result = await routeAiRequest(method, '/api/ai/settings', body);
    sendJson(res, result.status, result.body);
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message.slice(0, 300)
        : 'Não foi possível ler o pedido de configuração.';
    sendJson(res, 400, { code: 'entrada-invalida', message, retryable: false });
  }
}
