/**
 * Função serverless da Vercel: `GET /api/media/file?channelId=<canal>&episodeId=<episódio>&asset=<caminho>`.
 *
 * Serve **o arquivo** da arte gerada (thumbnail, imagem de cena) — é o que a tela mostra como prévia.
 *
 * **Esta função faltava, e a falta tinha o sintoma clássico deste projeto:** o caminho existia no
 * servidor de desenvolvimento (o plugin do Vite atende todo `/api/media/*`) e **não** existia em
 * produção — lá, sem arquivo em `api/media/file.ts`, a requisição cairia no rewrite de SPA e
 * devolveria **HTML com status 200**. O cliente tentaria ler HTML como imagem. É exatamente a
 * divergência "funciona na minha máquina" que o `ADR-014` e o teste
 * `src/__tests__/serverless-imports.test.ts` existem para impedir — só que na direção contrária:
 * rota que o navegador usa e que nunca chegou a virar função.
 *
 * A defesa contra travessia de caminho **não** mora aqui: `findManifestAsset` só serve o que está
 * registrado no manifesto daquele episódio daquele canal. Um caminho inventado (`..`, absoluto,
 * id de outro canal) não casa com nenhuma entrada e vira 404 antes de o disco ser tocado. E a guarda
 * de identidade vem antes de tudo (`server/auth/guard.ts`, chamada por `server/media/http.ts`): a arte
 * de um canal não é pública.
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
