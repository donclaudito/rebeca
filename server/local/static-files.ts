/**
 * Arquivos estáticos do app instalado: `dist/` + *fallback* de SPA.
 *
 * ## As três regras que este módulo existe para garantir
 *
 * 1. **Nada sai de `dist/`.** O caminho que chega vem do navegador; é ele que decide entre
 *    `../../.rebeca/segredos/llm.json` (a chave de IA, em texto claro no disco) e uma imagem. Por isso
 *    todo caminho é **resolvido** e conferido contra a raiz — a mesma segunda rede que
 *    `server/media/paths.ts` usa para o isolamento entre canais (`assertWithinChannel`), aplicada aqui
 *    ao disco inteiro. Recusar `..` por substituição de string não basta: `%2e%2e%2f` chega
 *    percent-encoded e a barra invertida do Windows também é separador.
 * 2. **Asset que não existe é 404 JSON, nunca `index.html`.** O app chama `/api/*` e carrega
 *    `/assets/*`; devolver HTML com status 200 nesses caminhos é o defeito que já custou horas neste
 *    projeto — a tela ficou carregando para sempre e o console dizia `Unexpected token <`
 *    (`server/ai/vite-plugin.ts`, `server/media/vite-plugin.ts`, e o relato "testei e não funcionou" em
 *    `.rebeca/estado.md`). O *fallback* de SPA só vale para **rota de página**, que é o que o
 *    `BrowserRouter` precisa (`/c/luna/inicio` não existe como arquivo).
 * 3. **O tipo vem do nome do arquivo, não do conteúdo.** Sem `Content-Type`, o navegador fareja o
 *    conteúdo — e o `nosniff` que acompanha a resposta transforma o palpite errado em erro visível.
 */

import { readFileSync, statSync } from 'node:fs';
import { extname, join, resolve, sep } from 'node:path';

export interface StaticFile {
  /** Caminho absoluto já conferido contra a raiz. */
  readonly absolutePath: string;
  readonly contentType: string;
  /** `assets/` tem hash no nome: pode ser cacheado para sempre. O resto, não. */
  readonly immutable: boolean;
}

/** Tipos que este app realmente serve. O que não está aqui sai como binário opaco, nunca como HTML. */
const CONTENT_TYPES: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.srt': 'application/x-subrip; charset=utf-8',
};

export function contentTypeFor(filePath: string): string {
  return CONTENT_TYPES[extname(filePath).toLowerCase()] ?? 'application/octet-stream';
}

function isFile(candidate: string): boolean {
  try {
    return statSync(candidate).isFile();
  } catch {
    return false;
  }
}

/** Resolve o caminho pedido para um arquivo **dentro** de `baseDir`, ou `null` se escapar. */
export function resolveWithin(baseDir: string, pathname: string): string | null {
  const base = resolve(baseDir);
  const target = resolve(base, pathname.replace(/^[/\\]+/, ''));
  if (target !== base && !target.startsWith(base + sep)) return null;
  return target;
}

/**
 * O caminho parece **arquivo** (e não rota de página)?
 *
 * A regra é o último segmento ter ponto — `app.js`, `icone-32.png`, `logo.abc123.svg` — ou o caminho
 * estar sob `assets/`. Uma rota de página (`/c/luna/inicio`, `/`) não tem ponto e por isso pode cair no
 * *fallback*; um asset ausente nunca cai, porque HTML 200 ali é falha silenciosa do cliente.
 */
export function looksLikeAsset(pathname: string): boolean {
  if (pathname.startsWith('/assets/')) return true;
  const last = pathname.split('/').filter(Boolean).at(-1) ?? '';
  return last.includes('.');
}

/**
 * Decide o que servir para um caminho de arquivo.
 *
 * Devolve `null` quando a resposta honesta é **404**: caminho que escapa de `dist/`, asset que não
 * existe e `index.html` ausente (app não construído — o `cli.ts` já avisa isso na subida, e aqui a
 * resposta continua sendo 404, não uma página em branco com 200).
 */
export function resolveStaticFile(distDir: string, pathname: string): StaticFile | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    // `%` solto: URI malformada. Não é caminho, é entrada inválida — e não vale tentar adivinhar.
    return null;
  }

  // Byte nulo trunca o caminho em APIs do sistema operacional: `index.html\u0000.png` poderia passar
  // por uma checagem de extensão e ser aberto como outra coisa. Recusar é mais barato que entender.
  if (decoded.includes('\0')) return null;

  const target = resolveWithin(distDir, decoded);
  if (target === null) return null;

  if (isFile(target)) {
    return {
      absolutePath: target,
      contentType: contentTypeFor(target),
      immutable: decoded.replace(/^\/+/, '').startsWith('assets/'),
    };
  }

  if (looksLikeAsset(decoded)) return null;

  const index = join(resolve(distDir), 'index.html');
  if (!isFile(index)) return null;

  return { absolutePath: index, contentType: CONTENT_TYPES['.html']!, immutable: false };
}

/** Lê o arquivo escolhido. Ausente entre a checagem e a leitura vira `null` (404), nunca 500. */
export function readStaticFile(file: StaticFile): Buffer | null {
  try {
    return readFileSync(file.absolutePath);
  } catch {
    return null;
  }
}
