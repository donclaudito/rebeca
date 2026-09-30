/**
 * Plugin do Vite que serve a API de IA em `pnpm dev`.
 *
 * Duas decisões que valem explicação:
 *
 * 1. **O middleware é registrado dentro de `configureServer`**, e não no retorno dele: assim ele entra
 *    *antes* do fallback de SPA do Vite. Registrado depois, `GET /api/ai/status` receberia o
 *    `index.html` do app, e o cliente falharia tentando interpretar HTML como JSON.
 *
 * 2. **O módulo do servidor é carregado por `ssrLoadModule`, não por `import` estático.** Com import
 *    estático, mexer num prompt ou no handler exigiria reiniciar o `pnpm dev` para ver o efeito — e o
 *    ciclo de trabalho com prompt é justamente editar e testar. Com `ssrLoadModule`, o Vite
 *    transforma e invalida o módulo na hora, então a alteração vale sem reiniciar. Efeito colateral
 *    bem-vindo: o grafo de módulos da config do Vite deixa de carregar 25 arquivos locais, o que
 *    elimina o aviso de "import sem extensão" que o carregador nativo do Vite reporta.
 *
 * A lógica em si **não** mora aqui: ela é `server/ai/http.ts`, a mesma função que a Vercel executa.
 * Este arquivo só liga a tomada.
 */

import type { Connect, Plugin } from 'vite';

const PREFIX = '/api/ai/';

interface AiHttpModule {
  readJsonBody: (req: Connect.IncomingMessage) => Promise<unknown>;
  routeAiRequest: (
    method: string,
    pathname: string,
    body: unknown,
  ) => Promise<{ status: number; body: unknown }>;
  sendJson: (res: import('node:http').ServerResponse, status: number, body: unknown) => void;
  /** Reexportado por `http.ts` para o plugin higienizar erro sem importar o grafo inteiro. */
  redact: (text: string) => string;
}

export function aiDevServer(): Plugin {
  return {
    name: 'rebeca-ai-dev-server',

    configureServer(server) {
      const middleware: Connect.NextHandleFunction = (req, res, next) => {
        const pathname = (req.url ?? '').split('?')[0] ?? '';

        if (!pathname.startsWith(PREFIX)) {
          next();
          return;
        }

        void (async () => {
          try {
            const module = (await server.ssrLoadModule('/server/ai/http.ts')) as unknown as AiHttpModule;
            const method = (req.method ?? 'GET').toUpperCase();
            const body = method === 'POST' ? await module.readJsonBody(req) : undefined;
            const result = await module.routeAiRequest(method, pathname, body);
            module.sendJson(res, result.status, result.body);
          } catch (error) {
            // Qualquer falha vira JSON de erro: devolver HTML aqui faria o cliente exibir
            // "Unexpected token <" em vez do motivo real. O detalhe passa por `redact` porque uma
            // falha de carregamento de módulo pode ecoar caminho com credencial embutida — o mesmo
            // cuidado que o handler tem no caminho de produção.
            const raw = error instanceof Error && error.message
              ? error.message
              : 'Falha ao carregar a camada de IA no servidor de desenvolvimento.';
            let message = raw;
            try {
              const module = (await server.ssrLoadModule('/server/ai/http.ts')) as unknown as AiHttpModule;
              message = module.redact(raw);
            } catch {
              // Se nem o módulo carrega, o erro é o do carregamento; não há o que higienizar além de
              // cortar o tamanho.
            }
            const payload = JSON.stringify({
              code: 'provedor',
              message: 'A camada de IA falhou no servidor de desenvolvimento.',
              detail: message.slice(0, 300),
              retryable: true,
            });
            res.statusCode = 500;
            res.setHeader('content-type', 'application/json; charset=utf-8');
            res.end(payload);
          }
        })();
      };

      server.middlewares.use(middleware);

      server.config.logger.info(
        '[ia] rotas locais ativas: GET /api/ai/status · POST /api/ai/generate (mesma função da Vercel)',
      );
    },
  };
}
