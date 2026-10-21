/**
 * O servidor de produção **local** — o terceiro plugue do Rebeca.
 *
 * ## Por que ele existe
 *
 * Até o `ADR-016`, a API do app existia em dois lugares: o middleware do servidor de desenvolvimento
 * (`server/ai/vite-plugin.ts`, `server/media/vite-plugin.ts`, `server/auth/vite-plugin.ts`) e as
 * funções serverless da Vercel (`api/*.ts`). Faltava justamente o
 * caminho de quem quer **usar** o app sem nuvem — e é o único caminho em que o pipeline de mídia
 * (`ffmpeg`) roda de verdade e o teto diário de gasto tem livro durável em disco.
 *
 * Este arquivo **não tem regra de negócio nenhuma**. Ele resolve caminho, monta a resposta e delega
 * para os mesmos roteadores dos outros dois plugues:
 *
 * | Prefixo | Roteador (o mesmo da Vercel) |
 * |---|---|
 * | `/api/ai/*` | `routeAiRequest` — `server/ai/http.ts` |
 * | `/api/media/*` | `routeMediaRequest` — `server/media/http.ts` |
 * | `/api/auth/*` | `routeAuthRequest` — `server/auth/http.ts` |
 *
 * Duplicar qualquer uma dessas regras aqui criaria a divergência que este projeto já pagou caro para
 * aprender: `pnpm dev` aceitando o que a produção recusa, e o defeito aparecendo só depois do deploy.
 * A guarda de identidade do `ADR-014` vem junto de graça, porque ela mora **dentro** dos roteadores —
 * se ela morasse nos plugues, este plugue novo seria a porta aberta para a chave paga.
 *
 * ## O que ele decide sozinho, e não é pouco
 *
 * - **`/api/*` desconhecido é 404 em JSON, nunca `index.html`.** Um caminho de API que cai no
 *   *fallback* de SPA devolve HTML com status 200, e o cliente quebra tentando interpretar HTML como
 *   JSON — o defeito que produziu a tela "carregando para sempre".
 * - **`REBECA_ROOT` é fixado na raiz do app** a partir do `options.root`. Ver `server/local/root.ts`.
 * - **Escuta só em `127.0.0.1`** (quem passa o host é o `cli.ts`): app que gasta dinheiro e carrega o
 *   token do Google não pode ficar exposto na rede da casa por causa de um padrão mal escolhido.
 */

import { createServer as createHttpServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { readJsonBody as readAiBody, redact, routeAiRequest, sendJson } from '../ai/http.js';
import { readJsonBody as readMediaBody, routeMediaRequest, sendMediaResult } from '../media/http.js';
import { routeAuthRequest } from '../auth/http.js';
import { localHeadersFor, readHeaderRules } from './security-headers.js';
import { readStaticFile, resolveStaticFile } from './static-files.js';
import { join, resolve } from 'node:path';

/** Métodos que carregam corpo. Ler só `POST` deixava `PUT /api/ai/settings` chegar vazio — já aconteceu. */
const METHODS_WITH_BODY: readonly string[] = ['POST', 'PUT', 'PATCH'];

export interface LocalServerOptions {
  /** Pasta do app: `dist/`, `vercel.json` e `.rebeca/` saem daqui. */
  readonly root: string;
}

/** Resposta de erro em JSON — usada em tudo que **não** é arquivo estático. */
function sendError(res: ServerResponse, status: number, code: string, message: string): void {
  sendJson(res, status, { code, message });
}

async function handleApi(
  req: IncomingMessage,
  res: ServerResponse,
  method: string,
  pathname: string,
  searchParams: URLSearchParams,
): Promise<boolean> {
  const authorization = req.headers.authorization ?? null;
  const hasBody = METHODS_WITH_BODY.includes(method);

  if (pathname.startsWith('/api/ai/')) {
    const result = await routeAiRequest(
      method,
      pathname,
      async () => (hasBody ? await readAiBody(req) : undefined),
      { authorization },
    );
    sendJson(res, result.status, result.body);
    return true;
  }

  if (pathname.startsWith('/api/media/')) {
    const result = await routeMediaRequest(
      method,
      pathname,
      searchParams,
      async () => (hasBody ? await readMediaBody(req) : undefined),
      { authorization },
    );
    sendMediaResult(res, result);
    return true;
  }

  if (pathname.startsWith('/api/auth/')) {
    const result = await routeAuthRequest(method, pathname, { authorization });
    sendJson(res, result.status, result.body);
    return true;
  }

  if (pathname.startsWith('/api/')) {
    /*
     * Rota de API que não existe. O 404 é em JSON **de propósito**: é o que faz o cliente do navegador
     * dizer "o servidor não conhece esta rota" em vez de `Unexpected token <`. E não há *fallback* de
     * SPA para API: página de HTML com status 200 num caminho de API é mentira que custa horas de
     * diagnóstico (foi assim que o painel de IA ficou num esqueleto de carregamento infinito).
     */
    sendError(res, 404, 'rota-desconhecida', `Não existe rota de API em ${pathname}.`);
    return true;
  }

  return false;
}

async function handleRequest(req: IncomingMessage, res: ServerResponse, root: string): Promise<void> {
  const method = (req.method ?? 'GET').toUpperCase();

  let url: URL;
  try {
    url = new URL(req.url ?? '/', 'http://127.0.0.1');
  } catch {
    sendError(res, 400, 'pedido-invalido', 'O caminho do pedido não é uma URL válida.');
    return;
  }

  const pathname = url.pathname;

  // Cabeçalhos antes de qualquer corpo: resposta sem eles, mesmo a de erro, é resposta sem a política.
  for (const [key, value] of localHeadersFor(pathname, readHeaderRules(join(root, 'vercel.json')))) {
    res.setHeader(key, value);
  }

  try {
    if (await handleApi(req, res, method, pathname, url.searchParams)) return;

    if (method === 'HEAD') {
      // Cabeçalhos de GET sem corpo: alguns clientes de verificação usam HEAD, e responder 405 aqui
      // faria um app saudável parecer quebrado.
      const file = resolveStaticFile(join(root, 'dist'), pathname);
      res.statusCode = file === null ? 404 : 200;
      if (file !== null) res.setHeader('content-type', file.contentType);
      res.end();
      return;
    }

    if (method !== 'GET') {
      sendError(res, 405, 'metodo-nao-permitido', `O servidor do app responde a GET e HEAD; recebi ${method}.`);
      return;
    }

    const file = resolveStaticFile(join(root, 'dist'), pathname);
    if (file === null) {
      sendError(
        res,
        404,
        'arquivo-nao-encontrado',
        `Não há arquivo em ${pathname}. Se o app não foi construído, rode a construção (dist/ ausente).`,
      );
      return;
    }

    const bytes = readStaticFile(file);
    if (bytes === null) {
      sendError(res, 404, 'arquivo-sumiu', `${pathname} não pôde ser lido agora.`);
      return;
    }

    res.statusCode = 200;
    res.setHeader('content-type', file.contentType);
    res.setHeader('content-length', String(bytes.length));
    /*
     * Asset com hash no nome vem do `vercel.json` (imutável por um ano). O HTML **não**:
     * ele é reescrito a cada versão do app e referencia assets novos. Um `index.html` em cache
     * serviria uma casca apontando para arquivo que não existe mais — e "atualizei o app e ele abriu
     * em branco" é um sintoma que ninguém liga a cabeçalho de cache.
     */
    if (file.immutable) res.setHeader('cache-control', 'public, max-age=31536000, immutable');
    else res.setHeader('cache-control', 'no-store');
    res.end(bytes);
  } catch (error) {
    /*
     * Falha inesperada vira JSON **higienizado**: `redact` é o mesmo removedor de segredo que a camada
     * de IA usa, e existe porque mensagem de exceção pode carregar chave de provedor embutida em URL.
     * Devolver a mensagem crua aqui seria vazamento pelo caminho mais curto: a tela.
     */
    const raw = error instanceof Error && error.message ? error.message : String(error);
    sendError(res, 500, 'servidor-local', `Falha ao responder: ${redact(raw).slice(0, 300)}`);
  }
}

/**
 * Cria o servidor. **Não** escuta: quem escuta é o `cli.ts` (e, nos testes, o próprio teste, em porta
 * efêmera — o que evita porta fixa disputada entre execuções).
 */
export function createLocalServer(options: LocalServerOptions): Server {
  const root = resolve(options.root);

  /*
   * Fixado aqui, e não no `cli.ts`, para que **todo** caminho de criação do servidor (inclusive o
   * teste) aponte `.rebeca/` para a raiz certa. `repoRoot()` lê esta variável no momento do uso; sem
   * ela, o pipeline de mídia gravaria ativos ao lado de onde o processo foi iniciado.
   */
  process.env['REBECA_ROOT'] = root;

  return createHttpServer((req, res) => {
    void handleRequest(req, res, root);
  });
}
