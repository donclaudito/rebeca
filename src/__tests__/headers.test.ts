/**
 * Refuta a divergência entre o **script inline que o app precisa** e o **hash que o CSP autoriza**.
 *
 * O defeito que originou este teste: `vercel.json` declara `Content-Security-Policy`, e a única
 * forma de manter um CSP estrito sem `'unsafe-inline'` é autorizar por **hash** o script de tema que
 * roda antes da primeira pintura (`index.html`, ver `src/app/theme.tsx`). Hash é valor derivado: no
 * dia em que alguém editar esse script — um comentário já basta — o CSP passa a bloquear o tema e o
 * sintoma é uma piscada clara na tela, não um erro. Ninguém ligaria uma coisa à outra.
 *
 * Este teste é a ligação: ele lê `index.html` e `vercel.json` do disco e falha se o hash autorizado
 * não for exatamente o hash de cada script inline que o documento carrega. Mesma ideia de
 * `src/data/__tests__/cycle.test.ts`, que lê `docs/00` em vez de repetir a lista.
 *
 * Ele também recusa `'unsafe-inline'` e `'unsafe-eval'` em `script-src`: sem isso, o hash vira
 * enfeite e o CSP perde a função.
 */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

interface VercelHeader {
  key: string;
  value: string;
}

interface VercelConfig {
  headers: { source: string; headers: VercelHeader[] }[];
}

const config: VercelConfig = JSON.parse(readFileSync(resolve(process.cwd(), 'vercel.json'), 'utf8'));
const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');

/** Cabeçalhos da regra que se aplica a todas as rotas (a de `source: /(.*)`). */
const globalHeaders = new Map<string, string>(
  (config.headers.find((rule) => rule.source === '/(.*)')?.headers ?? []).map((header) => [
    header.key,
    header.value,
  ]),
);

const csp = globalHeaders.get('Content-Security-Policy') ?? '';

/** Diretivas do CSP, normalizadas em `nome → lista de fontes`. */
function directives(policy: string): Map<string, string[]> {
  return new Map(
    policy
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const [name, ...sources] = part.split(/\s+/);
        return [name!.toLowerCase(), sources];
      }),
  );
}

const cspDirectives = directives(csp);

/** Conteúdo de cada `<script>` **sem `src`** — exatamente os bytes que o navegador vai hashear. */
function inlineScripts(document: string): string[] {
  const bodies: string[] = [];
  const pattern = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(document)) !== null) bodies.push(match[1]!);
  return bodies;
}

function cspHash(body: string): string {
  // O CSP exige o hash entre aspas simples (`'sha256-…'`); sem elas a diretiva é ignorada em
  // silêncio e o script inline é bloqueado — falha que só apareceria na tela do usuário.
  return `'sha256-${createHash('sha256').update(body, 'utf8').digest('base64')}'`;
}

describe('cabeçalhos de segurança do deploy', () => {
  it('tem uma regra de cabeçalhos para todas as rotas', () => {
    expect(globalHeaders.size).toBeGreaterThan(0);
  });

  it('declara Content-Security-Policy de verdade (não vazia)', () => {
    expect(csp).not.toBe('');
    expect(cspDirectives.get('default-src')).toEqual(["'self'"]);
  });

  it('autoriza por hash cada script inline que o documento carrega', () => {
    const bodies = inlineScripts(html);
    expect(bodies.length).toBeGreaterThan(0);

    const autorizados = cspDirectives.get('script-src') ?? [];
    for (const body of bodies) {
      expect(autorizados).toContain(cspHash(body));
    }
  });

  it('não afrouxa o script-src com unsafe-inline nem unsafe-eval', () => {
    const autorizados = cspDirectives.get('script-src') ?? [];
    expect(autorizados).not.toContain("'unsafe-inline'");
    expect(autorizados).not.toContain("'unsafe-eval'");
    expect(autorizados).toContain("'self'");
  });

  it('fecha as diretivas que sobram quando só default-src é declarado', () => {
    expect(cspDirectives.get('object-src')).toEqual(["'none'"]);
    expect(cspDirectives.get('base-uri')).toEqual(["'none'"]);
    expect(cspDirectives.get('form-action')).toEqual(["'none'"]);
    expect(cspDirectives.get('frame-ancestors')).toEqual(["'none'"]);
  });

  it('declara os cabeçalhos de transporte e de enquadramento', () => {
    expect(globalHeaders.get('Strict-Transport-Security')).toMatch(/max-age=\d{6,}/);
    expect(globalHeaders.get('X-Content-Type-Options')).toBe('nosniff');
    expect(globalHeaders.get('X-Frame-Options')).toBe('DENY');
    expect(globalHeaders.get('Cross-Origin-Opener-Policy')).toBe('same-origin');
    expect(globalHeaders.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
  });

  it('não permite câmera, microfone, localização nem pagamento', () => {
    const policy = globalHeaders.get('Permissions-Policy') ?? '';
    for (const recurso of ['camera', 'microphone', 'geolocation', 'payment']) {
      expect(policy).toContain(`${recurso}=()`);
    }
  });

  it('engessa o cache só dos assets com hash no nome', () => {
    const assets = config.headers.find((rule) => rule.source === '/assets/(.*)');
    const cache = assets?.headers.find((header) => header.key === 'Cache-Control')?.value ?? '';
    expect(cache).toContain('immutable');
    // O HTML é reescrito a cada deploy e referencia assets novos: cacheá-lo por 1 ano serviria
    // HTML velho apontando para asset que não existe mais.
    expect(globalHeaders.get('Cache-Control')).toBeUndefined();
  });
});
