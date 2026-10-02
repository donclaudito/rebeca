/**
 * Plugin do Vite que serve a leitura de mídia em `pnpm dev`.
 *
 * Espelha `server/ai/vite-plugin.ts`, e pelas mesmas duas razões:
 *
 * 1. **O middleware é registrado dentro de `configureServer`**, não no retorno dele: assim ele entra
 *    *antes* do fallback de SPA. Registrado depois, `GET /api/media/episodes` receberia o `index.html`
 *    com status 200, e o cliente falharia tentando interpretar HTML como JSON. Esse defeito já aconteceu
 *    de verdade com a camada de IA — a tela ficou carregando para sempre sem dizer por quê.
 * 2. **O módulo do servidor é carregado por `ssrLoadModule`**: mexer no leitor de manifesto passa a
 *    valer sem reiniciar o `pnpm dev`, que é o ciclo de trabalho real (rodar o pipeline, olhar a tela).
 *
 * A lógica não mora aqui: é `server/media/http.ts`, a mesma função que a Vercel executa em
 * `api/media/*`.
 */

import type { Connect, Plugin } from 'vite';

const PREFIX = '/api/media/';

interface MediaHttpModule {
  readJsonBody: (req: import('node:http').IncomingMessage) => Promise<unknown>;
  routeMediaRequest: (
    method: string,
    pathname: string,
    searchParams: URLSearchParams,
    lerCorpo?: () => Promise<unknown>,
    options?: { authorization?: string | null },
  ) => Promise<{ status: number; body?: unknown; file?: { absolutePath: string; contentType: string } }>;
  sendMediaResult: (
    res: import('node:http').ServerResponse,
    result: { status: number; body?: unknown; file?: { absolutePath: string; contentType: string } },
  ) => void;
}

export function mediaDevServer(): Plugin {
  return {
    name: 'rebeca-media-dev-server',

    configureServer(server) {
      const middleware: Connect.NextHandleFunction = (req, res, next) => {
        const url = new URL(req.url ?? '/', 'http://localhost');

        if (!url.pathname.startsWith(PREFIX)) {
          next();
          return;
        }

        void (async () => {
          try {
            const module = (await server.ssrLoadModule('/server/media/http.ts')) as unknown as MediaHttpModule;
            const method = (req.method ?? 'GET').toUpperCase();
            // POST **e** PUT têm corpo. Sem isto, `POST /api/media/thumbnails` chegaria sem canal e a tela
            // receberia "informe o canal" com o canal na frente — o mesmo defeito de encanamento que já
            // apareceu com `PUT /api/ai/settings`.
            const hasBody = method === 'POST' || method === 'PUT' || method === 'PATCH';
            // O header `authorization` é repassado: o servidor de desenvolvimento aplica a **mesma**
            // guarda da produção. Se ele ficasse de fora, `pnpm dev` aceitaria o que a Vercel recusa —
            // e o defeito só apareceria publicado, que é o pior lugar para descobrir.
            //
            // O corpo entra como **função**, e não como valor: a leitura acontece dentro do roteador,
            // depois da guarda (defeito 1 do `QA-014`).
            const result = await module.routeMediaRequest(
              method,
              url.pathname,
              url.searchParams,
              async () => (hasBody ? await module.readJsonBody(req) : undefined),
              { authorization: req.headers.authorization ?? null },
            );
            module.sendMediaResult(res, result);
          } catch (error) {
            // Falha de carregamento do módulo também precisa virar JSON: HTML aqui faria o cliente
            // exibir "Unexpected token <" em vez do motivo real.
            const detail = error instanceof Error && error.message ? error.message : String(error);
            const payload = JSON.stringify({
              code: 'leitura-de-midia',
              message: 'A leitura de mídia falhou no servidor de desenvolvimento.',
              detail: detail.slice(0, 300),
            });
            res.statusCode = 500;
            res.setHeader('content-type', 'application/json; charset=utf-8');
            res.end(payload);
          }
        })();
      };

      server.middlewares.use(middleware);

      server.config.logger.info(
        '[mídia] rotas locais ativas: GET /api/media/episodes · GET /api/media/episode (mesma função da Vercel)',
      );
    },
  };
}
