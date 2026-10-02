/**
 * Função serverless da Vercel: `POST /api/media/thumbnails`.
 *
 * É a rota que **faz a arte existir** — a única que pode gastar dinheiro. Recebe
 * `{ channelId, episodeId }` e devolve as quatro opções geradas, com provedor, custo real e o caminho de
 * cada arquivo.
 *
 * O corpo é lido aqui porque a função da Vercel não recebe o corpo parseado; a lógica (allow-list,
 * idempotência, teto de gasto, gravação e livro de custos) mora em `server/media/http.ts`, a **mesma**
 * função que o servidor de desenvolvimento executa.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { readJsonBody, routeMediaRequest, sendMediaResult } from '../../server/media/http.js';

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const method = (req.method ?? 'GET').toUpperCase();
  const hasBody = method === 'POST' || method === 'PUT' || method === 'PATCH';

  /*
   * O corpo é passado como **função**, não como valor: a leitura acontece dentro do roteador, depois
   * da guarda de identidade. Lendo aqui, uma requisição **sem credencial nenhuma** com corpo inválido
   * respondia 400 `corpo-invalido` em vez de 401, e o processo ainda analisava o corpo de quem não se
   * identificou — defeito 1 do `QA-014`, medido pelo `rebeca-qa`.
   */
  const result = await routeMediaRequest(
    method,
    url.pathname,
    url.searchParams,
    async () => (hasBody ? await readJsonBody(req) : undefined),
    { authorization: req.headers.authorization ?? null },
  );
  sendMediaResult(res, result);
}
