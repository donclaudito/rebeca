/**
 * Função serverless da Vercel: `GET /api/ai/status`.
 *
 * Diz ao app, sem revelar nenhuma chave, quais fornecedores estão configurados, qual modelo atende
 * cada função e qual é o teto de gasto em vigor. É o que permite a tela de Configurações dizer a
 * verdade em vez de o usuário descobrir na tentativa e erro.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { routeAiRequest, sendJson } from '../../server/ai/http';

export default async function handler(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  const result = await routeAiRequest('GET', '/api/ai/status', undefined);
  sendJson(res, result.status, result.body);
}
