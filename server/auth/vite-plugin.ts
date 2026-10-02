/**
 * Plugin do Vite que serve as rotas de autenticação em `pnpm dev`.
 *
 * Espelha os plugins de IA e de mídia, e pelas mesmas razões: o middleware entra **antes** do
 * fallback de SPA (senão `/api/auth/config` devolveria o `index.html` com status 200 e o cliente
 * concluiria que a autenticação não existe) e o módulo é carregado por `ssrLoadModule`, para editar a
 * guarda e ver o efeito sem reiniciar o servidor.
 *
 * A lógica é `server/auth/http.ts` — a mesma função que a Vercel executa em `api/auth/*`.
 *
 * **Uma diferença em relação aos outros dois plugins, e ela é deliberada:** aqui o header
 * `authorization` da requisição é repassado para a guarda. Sem isso, o servidor de desenvolvimento
 * aceitaria qualquer chamada e o defeito apareceria só em produção — que é exatamente o padrão de
 * falha ("em localhost funciona") que esta entrega existe para eliminar.
 */

import type { Connect, Plugin } from 'vite';

const PREFIX = '/api/auth/';

interface AuthHttpModule {
  routeAuthRequest: (
    method: string,
    pathname: string,
    context: { authorization?: string | null },
  ) => Promise<{ status: number; body: unknown }>;
}

export function authDevServer(): Plugin {
  return {
    name: 'rebeca-auth-dev-server',

    configureServer(server) {
      /*
       * Cabeçalhos que a documentação do Google pede para **http + localhost**, e que fazem o servidor
       * de desenvolvimento dizer a mesma coisa que a produção:
       *
       * - `Cross-Origin-Opener-Policy: same-origin-allow-popups` — é o valor que a doc de Setup
       *   prescreve para o pop-up conseguir devolver a credencial ("Failing to set the proper header
       *   breaks communication between windows, leading to a blank pop-up window"). O `vercel.json` já
       *   manda isso em produção; o dev não mandava **nada**, e a diferença entre os dois ambientes é
       *   exatamente onde nascem os defeitos de "no meu computador funciona".
       * - `Referrer-Policy: no-referrer-when-downgrade` — a mesma página de Setup pede este valor
       *   nominalmente para o caso http + localhost (diferente do
       *   `strict-origin-when-cross-origin` que usamos em produção, que é https).
       *
       * Registrado **antes** dos middlewares internos do Vite, para valer também no documento (`/`).
       */
      server.middlewares.use((_req, res, next) => {
        res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
        res.setHeader('Referrer-Policy', 'no-referrer-when-downgrade');
        next();
      });

      const middleware: Connect.NextHandleFunction = (req, res, next) => {
        const pathname = (req.url ?? '').split('?')[0] ?? '';

        if (!pathname.startsWith(PREFIX)) {
          next();
          return;
        }

        void (async () => {
          try {
            const module = (await server.ssrLoadModule('/server/auth/http.ts')) as unknown as AuthHttpModule;
            const method = (req.method ?? 'GET').toUpperCase();
            const result = await module.routeAuthRequest(method, pathname, {
              authorization: req.headers.authorization ?? null,
            });

            /*
             * **Instrumento de diagnóstico do desenvolvimento** (não existe em produção: o código de
             * `/api/auth/me` e das funções `api/*` não o conhece).
             *
             * Quando uma conta é recusada, imprime no console do `pnpm dev` o `sub` que o Google
             * mandou **com os códigos de cada caractere** e a lista que o servidor comparou. Existe
             * por causa do defeito que custou horas ao dono: a lista estava configurada com números
             * transcritos a olho de uma captura de tela — 21 dígitos, dois deles trocados — e a tela
             * recusava a conta com o `sub` "certo" na mão. Com esta linha, autorizar uma conta nova é
             * copiar do terminal; nunca mais se digita um `sub`.
             *
             * Só dispara na recusa: em uso normal o console fica limpo.
             */
            if (pathname === `${PREFIX}me` && (result.body as { authorized?: boolean } | undefined)?.authorized === false) {
              const corpo = result.body as { identity?: { sub?: string } } | undefined;
              const sub = corpo?.identity?.sub;
              const access = (await server.ssrLoadModule('/server/auth/access.ts')) as unknown as {
                allowedSubs: () => ReadonlySet<string>;
                limparIdentificador: (valor: string) => string;
              };
              const lista = access.allowedSubs();
              const codigos = (valor: string): string => [...valor].map((c) => c.charCodeAt(0)).join(' ');
              const subTexto = typeof sub === 'string' ? sub : '(sem identidade)';
              const limpo = typeof sub === 'string' ? access.limparIdentificador(sub) : '';
              server.config.logger.warn(
                `\n[auth] CONTA RECUSADA (não está em REBECA_ALLOWED_SUBS)\n` +
                  `  sub recebido : "${subTexto}" (${subTexto.length} caracteres)\n` +
                  (typeof sub === 'string' && limpo !== sub ? `  sub sem invisíveis: "${limpo}"\n` : '') +
                  `  código       : [${codigos(subTexto)}]\n` +
                  `  lista atual  : ${[...lista].map((m) => `"${m}"`).join(', ')}\n` +
                  `  PARA AUTORIZAR: copie o "sub recebido" acima para REBECA_ALLOWED_SUBS no .env\n`,
              );
            }

            res.statusCode = result.status;
            res.setHeader('content-type', 'application/json; charset=utf-8');
            // Resposta de identidade não pode ser cacheada por intermediário: ela muda com a sessão.
            res.setHeader('cache-control', 'no-store');
            res.end(JSON.stringify(result.body ?? {}));
          } catch (error) {
            const detail = error instanceof Error && error.message ? error.message : String(error);
            res.statusCode = 500;
            res.setHeader('content-type', 'application/json; charset=utf-8');
            res.end(
              JSON.stringify({
                code: 'autenticacao',
                message: 'A autenticação falhou no servidor de desenvolvimento.',
                detail: detail.slice(0, 300),
                retryable: true,
              }),
            );
          }
        })();
      };

      server.middlewares.use(middleware);

      server.config.logger.info(
        '[auth] rotas locais ativas: GET /api/auth/config (pública) · GET /api/auth/me (exige token)',
      );
    },
  };
}
