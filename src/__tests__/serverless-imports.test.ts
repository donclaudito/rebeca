/**
 * Guarda contra a reintrodução do defeito que derrubou a IA em produção (500 em `/api/ai/*`).
 *
 * Por que este teste existe, com todas as letras:
 *
 * O `@vercel/node` **não faz bundle**. Ele traça o grafo com `@vercel/nft` e transpila **cada `.ts`
 * individualmente**, renomeando para `.js` e **preservando os specifiers de import**. Como o
 * `package.json` deste projeto tem `"type": "module"`, esse passe deixa de converter ESM→CJS
 * (`if (pkg.type === 'module' && path.endsWith('.js')) continue`) e vale a regra do loader ESM do
 * Node: **import relativo exige extensão**. Um `'../../server/ai/http'` sem extensão vira
 * `ERR_MODULE_NOT_FOUND` no cold start da função — HTTP 500 em produção.
 *
 * O detalhe cruel: **nem `tsc`, nem o Vite, nem a suíte pegam isso.** `moduleResolution: "bundler"`
 * aceita os dois formatos, e o Vite resolve `.js` → `.ts` (por isso o dev server continua
 * funcionando). Sem este teste, o defeito só reaparece no ar — foi exatamente o que aconteceu.
 *
 * O que ele faz: percorre o grafo REAL a partir dos entrypoints que a Vercel executa (`api/**`), segue
 * todo import relativo (estático, `import type`, `import()` dinâmico, `export ... from`) e exige
 * duas coisas de cada um: (1) extensão explícita `.js`; (2) que o arquivo de destino exista — como
 * `.ts` no repositório (o builder renomeia para `.js`).
 *
 * Não é análise de texto sobre `src/**`: é sobre `api/**` e `server/**` e o que eles alcançam.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/*
 * Raiz do projeto pelo `cwd` do Vitest, e não por `import.meta.url`: no ambiente jsdom o Vite serve
 * o módulo por HTTP e `import.meta.url` deixa de ser uma URL `file:`, então `fileURLToPath` recusa.
 * O teste confere abaixo que a raiz está certa — se o `cwd` mudar, ele falha dizendo isso, em vez de
 * passar vazio.
 */
const ROOT = process.cwd();

/** Os arquivos que a Vercel transforma em função, e o módulo compartilhado que cada um tem de alcançar. */
const ENTRYPOINTS: ReadonlyArray<{ readonly path: string; readonly shared: string }> = [
  { path: 'api/ai/generate.ts', shared: '../../server/ai/http.js' },
  { path: 'api/ai/settings.ts', shared: '../../server/ai/http.js' },
  { path: 'api/ai/status.ts', shared: '../../server/ai/http.js' },
  { path: 'api/ai/test.ts', shared: '../../server/ai/http.js' },
  // Rotas da mídia gerada. Entraram na guarda no mesmo dia em que foram criadas: rota nova fora do
  // grafo conferido é rota que pode ganhar um import sem extensão e só quebrar no ar.
  { path: 'api/media/custos.ts', shared: '../../server/media/http.js' },
  { path: 'api/media/episode.ts', shared: '../../server/media/http.js' },
  { path: 'api/media/episodes.ts', shared: '../../server/media/http.js' },
  // A rota que serve a arte em si. **Faltava** — o caminho era atendido só pelo plugin do Vite, e em
  // produção a requisição cairia no rewrite de SPA e devolveria HTML com status 200 (o navegador
  // tentaria ler HTML como imagem). Rota que o cliente usa e que não virou função é o mesmo defeito
  // de paridade dev↔produção, na direção contrária.
  { path: 'api/media/file.ts', shared: '../../server/media/http.js' },
  { path: 'api/media/thumbnails.ts', shared: '../../server/media/http.js' },
  // Rotas de autenticação (`ADR-014`). A de `config` é pública; a de `me` exige token. As duas entram
  // na guarda: a verificação do ID token acontece no servidor, então um import sem extensão aqui
  // derrubaria **o login inteiro** no ar — o app publicado não abriria para ninguém.
  { path: 'api/auth/config.ts', shared: '../../server/auth/http.js' },
  { path: 'api/auth/me.ts', shared: '../../server/auth/http.js' },
];

/**
 * Os entrypoints do **app instalável** (`ADR-016`), pelo mesmo motivo e com a mesma regra.
 *
 * Aqui não há builder: o `tsc` emite `build/` e quem executa é o Node puro. A regra do loader ESM é
 * idêntica — import relativo exige extensão —, então um `import { createLocalServer } from './server'`
 * (sem `.js`) derrubaria o app instalado com `ERR_MODULE_NOT_FOUND` **na subida**, antes de responder
 * uma única requisição. E, como no caso da Vercel, nem `tsc` nem o Vite nem o `pnpm dev` pegariam:
 * `moduleResolution: "bundler"` aceita os dois formatos.
 *
 * O `shared` de cada um registra a paridade que importa: o servidor local **não tem rota própria** —
 * ele alcança exatamente os roteadores que a Vercel executa.
 */
const ENTRYPOINTS_LOCAL: ReadonlyArray<{ readonly path: string; readonly shared: string }> = [
  { path: 'server/local/cli.ts', shared: './server.js' },
  { path: 'server/local/server.ts', shared: '../ai/http.js' },
  { path: 'server/local/server.ts', shared: '../media/http.js' },
  { path: 'server/local/server.ts', shared: '../auth/http.js' },
];

/**
 * Specifiers relativos, nas quatro formas que o JavaScript/TypeScript aceita.
 *
 * Grupo 1: o prefixo (`from '`, `import('`, `export ... from '`).
 * Grupo 2: o specifier relativo em si.
 */
const RELATIVE_SPECIFIER =
  /(?:from\s+|import\(\s*|export\s+\*\s+from\s+|export\s+\{[^}]*\}\s+from\s+)['"](\.[^'"]*)['"]/g;

interface ImportFound {
  readonly from: string;
  readonly specifier: string;
  readonly line: number;
}

function findRelativeImports(file: string): ImportFound[] {
  const source = readFileSync(file, 'utf8');
  const found: ImportFound[] = [];
  for (const match of source.matchAll(RELATIVE_SPECIFIER)) {
    const specifier = match[1];
    if (specifier === undefined) continue;
    const index = match.index ?? 0;
    found.push({
      from: relative(ROOT, file).replace(/\\/g, '/'),
      specifier,
      line: source.slice(0, index).split('\n').length,
    });
  }
  return found;
}

/** Resolve o specifier para o arquivo que existe no repositório (o builder renomeia `.ts` → `.js`). */
function resolveTarget(file: string, specifier: string): string | null {
  const base = resolve(dirname(file), specifier);
  const candidates = specifier.endsWith('.js')
    ? [base, base.replace(/\.js$/, '.ts'), base.replace(/\.js$/, '.tsx')]
    : [base, `${base}.ts`, `${base}.tsx`];
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

/** Percorre o grafo a partir dos entrypoints dados, seguindo só imports relativos. */
function walkGraph(
  entrypoints: ReadonlyArray<{ readonly path: string }> = ENTRYPOINTS,
): { files: string[]; imports: ImportFound[] } {
  const visited = new Set<string>();
  const imports: ImportFound[] = [];
  const queue = entrypoints.map((entry) => join(ROOT, entry.path));

  while (queue.length > 0) {
    const file = queue.pop();
    if (file === undefined || visited.has(file)) continue;
    visited.add(file);

    for (const found of findRelativeImports(file)) {
      imports.push(found);
      const target = resolveTarget(file, found.specifier);
      if (target && !visited.has(target)) queue.push(target);
    }
  }

  return { files: [...visited], imports };
}

describe('grafo executado pela Vercel (api/** e server/**)', () => {
  const { files, imports } = walkGraph();

  it('alcança o grafo real a partir dos entrypoints da Vercel', () => {
    // Sanidade do próprio teste: se o regex parar de casar, isto falha em vez de passar vazio.
    expect(
      ENTRYPOINTS.filter((entry) => existsSync(join(ROOT, entry.path))).map((entry) => entry.path),
      `não achei os entrypoints de api/ a partir de "${ROOT}" — rode a suíte da raiz do projeto`,
    ).toEqual(ENTRYPOINTS.map((entry) => entry.path));
    expect(files.length).toBeGreaterThanOrEqual(14);
    expect(imports.length).toBeGreaterThanOrEqual(35);
  });

  it('todo import relativo do grafo tem extensão explícita .js', () => {
    const semExtensao = imports.filter((found) => !found.specifier.endsWith('.js'));
    expect(
      semExtensao.map((found) => `${found.from}:${found.line} → '${found.specifier}'`),
      'Import relativo sem extensão quebra a função na Vercel com ERR_MODULE_NOT_FOUND. ' +
        'Escreva o specifier terminando em .js (ex.: "./handler.js"), inclusive em `import type` ' +
        'e em `import()` dinâmico. Ver docs/… e .rebeca/evidencias/vercel-500-imports-esm.txt.',
    ).toEqual([]);
  });

  it('todo import relativo do grafo aponta para arquivo que existe', () => {
    const quebrados: string[] = [];
    for (const file of files) {
      for (const found of findRelativeImports(file)) {
        if (resolveTarget(file, found.specifier) === null) {
          quebrados.push(`${found.from}:${found.line} → '${found.specifier}'`);
        }
      }
    }
    expect(quebrados).toEqual([]);
  });

  it('cada entrypoint da Vercel importa a camada compartilhada com extensão .js', () => {
    for (const entry of ENTRYPOINTS) {
      const imports = findRelativeImports(join(ROOT, entry.path));
      expect(imports.length, `${entry.path} não importa nada — o teste perdeu o valor`).toBeGreaterThan(0);
      expect(imports.map((found) => found.specifier), `${entry.path} não alcança ${entry.shared}`).toContain(
        entry.shared,
      );
    }
  });
});

/**
 * O mesmo grafo, agora a partir do servidor do app instalável (`ADR-016`).
 *
 * Duas coisas se verificam aqui, e a segunda é a que protege o desenho:
 *
 * 1. **Extensão nos imports** — o `tsc` preserva os specifiers que o código escreve; um deles sem `.js`
 *    vira `ERR_MODULE_NOT_FOUND` quando o Node executa `build/server/local/cli.js`. Nada mais na
 *    toolchain pega isso.
 * 2. **Paridade com a Vercel** — o servidor local tem de alcançar **os mesmos** roteadores
 *    (`server/ai/http.ts`, `server/media/http.ts`, `server/auth/http.ts`). Se algum dia alguém
 *    "resolver rápido" escrevendo uma rota só para o local, este teste fica vermelho — e é o defeito
 *    que o projeto já pagou caro para aprender (`pnpm dev` aceitando o que a produção recusa).
 */
describe('grafo do servidor do app instalável (ADR-016)', () => {
  const { files, imports } = walkGraph(ENTRYPOINTS_LOCAL);

  it('alcança o grafo real a partir dos entrypoints do app local', () => {
    for (const entry of ENTRYPOINTS_LOCAL) {
      expect(existsSync(join(ROOT, entry.path)), `${entry.path} não existe`).toBe(true);
    }
    expect(files.length).toBeGreaterThanOrEqual(14);
    expect(imports.length).toBeGreaterThanOrEqual(25);
  });

  it('todo import relativo do grafo local tem extensão explícita .js', () => {
    const semExtensao = imports.filter((found) => !found.specifier.endsWith('.js'));
    expect(
      semExtensao.map((found) => `${found.from}:${found.line} → '${found.specifier}'`),
      'Import relativo sem extensão quebra o app instalado com ERR_MODULE_NOT_FOUND na subida.',
    ).toEqual([]);
  });

  it('todo import relativo do grafo local aponta para arquivo que existe', () => {
    const quebrados: string[] = [];
    for (const file of files) {
      for (const found of findRelativeImports(file)) {
        if (resolveTarget(file, found.specifier) === null) {
          quebrados.push(`${found.from}:${found.line} → '${found.specifier}'`);
        }
      }
    }
    expect(quebrados).toEqual([]);
  });

  it('o servidor local monta os mesmos roteadores que a Vercel executa', () => {
    const alcancados = new Set(
      files.map((file) => relative(ROOT, file).replace(/\\/g, '/')),
    );

    const roteadores = ['server/ai/http.ts', 'server/media/http.ts', 'server/auth/http.ts'];
    for (const roteador of roteadores) {
      expect(alcancados.has(roteador), `o servidor local não alcança ${roteador}`).toBe(true);
    }

    // E os mesmos roteadores são alcançados pelo grafo da Vercel — é isso que faz "mesma função nos
    // três plugues" ser fato verificado, e não promessa no comentário.
    const alcancadosPelaVercel = new Set(walkGraph(ENTRYPOINTS).files.map((file) => relative(ROOT, file).replace(/\\/g, '/')));
    for (const roteador of roteadores) {
      expect(alcancadosPelaVercel.has(roteador), `a Vercel não executa ${roteador}`).toBe(true);
    }
  });
});
