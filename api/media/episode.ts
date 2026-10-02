/**
 * Função serverless da Vercel: `GET /api/media/episode?channelId=<canal>&episodeId=<episódio>`.
 *
 * Lê o manifesto do episódio e devolve cada ativo com o disco **medido** (`existsOnDisk`), os tetos de
 * gasto que estavam em vigor quando ele foi gerado e se a referência visual é sintética. É o que
 * permite a tela dizer "13 ativos gerados por provedor simulado" em vez de afirmar que existe um vídeo
 * pronto — que foi exatamente o defeito corrigido na tela de Revisão.
 *
 * A lógica não mora aqui: é `server/media/http.ts`, a mesma função que o servidor de desenvolvimento
 * executa.
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
