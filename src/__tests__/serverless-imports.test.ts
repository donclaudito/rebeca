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
 * O que ele faz: percorre o grafo REAL a partir dos quatro entrypoints que a Vercel executa, segue
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

/** Os quatro arquivos que a Vercel transforma em função. */
const ENTRYPOINTS = [
  'api/ai/generate.ts',
  'api/ai/settings.ts',
  'api/ai/status.ts',
  'api/ai/test.ts',
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

/** Percorre o grafo a partir dos entrypoints, seguindo só imports relativos. */
function walkGraph(): { files: string[]; imports: ImportFound[] } {
  const visited = new Set<string>();
  const imports: ImportFound[] = [];
  const queue = ENTRYPOINTS.map((entry) => join(ROOT, entry));

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

  it('alcança o grafo real a partir dos quatro entrypoints', () => {
    // Sanidade do próprio teste: se o regex parar de casar, isto falha em vez de passar vazio.
    expect(
      ENTRYPOINTS.filter((entry) => existsSync(join(ROOT, entry))),
      `não achei api/ai/*.ts a partir de "${ROOT}" — rode a suíte da raiz do projeto`,
    ).toHaveLength(4);
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

  it('os entrypoints da Vercel ficam dentro de api/ai/ e importam a camada compartilhada com .js', () => {
    for (const entry of ENTRYPOINTS) {
      const imports = findRelativeImports(join(ROOT, entry));
      expect(imports.length, `${entry} não importa nada — o teste perdeu o valor`).toBeGreaterThan(0);
      expect(imports.map((found) => found.specifier)).toContain('../../server/ai/http.js');
    }
  });
});
