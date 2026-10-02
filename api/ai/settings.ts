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
import { readJsonBody, redact, routeAiRequest, sendJson } from '../../server/ai/http.js';

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const method = (req.method ?? 'GET').toUpperCase();
  try {
    // Corpo como função: lido **depois** da guarda (defeito 1 do `QA-014`). `GET` não tem corpo.
    const lerCorpo = async (): Promise<unknown> => (method === 'GET' ? undefined : readJsonBody(req));
    const result = await routeAiRequest(method, '/api/ai/settings', lerCorpo, {
      authorization: req.headers.authorization ?? null,
    });
    sendJson(res, result.status, result.body);
  } catch (error) {
    /*
     * Rede de segurança: o caminho normal já devolve erro em JSON pelo roteador. A mensagem passa por
     * `redact` porque este é o único ponto de saída desta API que não tinha o filtro, e uma exceção
     * inesperada pode ecoar URL com credencial embutida (achado 6 do `QA-014`).
     */
    const message = redact(
      error instanceof Error && error.message
        ? error.message.slice(0, 300)
        : 'Não foi possível ler o pedido de configuração.',
    );
    sendJson(res, 400, { code: 'entrada-invalida', message, retryable: false });
  }
}
