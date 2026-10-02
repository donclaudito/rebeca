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
import { existsSync, readFileSync } from 'node:fs';
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
    expect(cspDirectives.get('default-src')).toContain("'self'");
    /*
     * A documentação oficial manda incluir o pai do GIS também no `default-src`, porque ele é o
     * **fallback** de qualquer diretiva ausente. Hoje as quatro diretivas do Google estão declaradas
     * explicitamente e isso não faz diferença — mas no dia em que alguém remover uma delas, o
     * fallback é a única coisa que segura o botão de login. Achado 4 do `QA-014`.
     */
    expect(cspDirectives.get('default-src')).toContain('https://accounts.google.com/gsi/');
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
    /*
     * `same-origin-allow-popups`, e não `same-origin`.
     *
     * Este era `same-origin` até o `ADR-014`. A documentação oficial do Sign in with Google é
     * explícita: com FedCM desabilitado, o COOP precisa incluir `same-origin-allow-popups`, senão "a
     * comunicação entre janelas quebra e o pop-up abre em branco". O valor antigo era exatamente o
     * caso de falha descrito — e o sintoma (pop-up em branco) não aponta para cabeçalho nenhum, é o
     * tipo de defeito que se procura no JavaScript por horas.
     */
    expect(globalHeaders.get('Cross-Origin-Opener-Policy')).toBe('same-origin-allow-popups');
    expect(globalHeaders.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
  });

  /*
   * CSP × Google Identity Services.
   *
   * O app entra com a conta Google, e a biblioteca vem de `accounts.google.com` — não é hospedada
   * aqui (a doc oficial diz que autohospedar "não é caso de uso suportado"). Sem estas quatro
   * autorizações, o CSP estrito que o `ADR-008` montou **bloqueia a própria entrada**: o botão não
   * aparece, ou aparece e não conclui, e o console do navegador é o único lugar onde isso se lê.
   *
   * Os valores são exatamente os da documentação (Setup — Sign in with Google for Web, atualizada
   * 2026-04-06, lida em 2026-10-02): `gsi/client` no script, `gsi/style` no estilo, `gsi/` no frame e
   * na conexão. A doc pede o **pai** da URL, não a URL individual, justamente para não quebrar quando
   * o Google mudar um caminho interno.
   */
  it('autoriza a biblioteca do Google a carregar, estilizar, enquadrar e conectar', () => {
    const script = cspDirectives.get('script-src') ?? [];
    expect(script).toContain('https://accounts.google.com/gsi/client');

    const style = cspDirectives.get('style-src') ?? [];
    expect(style).toContain('https://accounts.google.com/gsi/style');

    /*
     * E `'unsafe-inline'` — que a doc do Google **não** lista, e sem o qual o botão quebra.
     *
     * `https://accounts.google.com/gsi/style` autoriza carregar uma folha **externa** daquela origem.
     * Não autoriza os `<style>` que o `gsi/client` injeta **em tempo de execução**. Medido no console
     * do navegador em 2026-10-02, com esta política já no ar:
     *
     *   "Applying inline style violates the following Content Security Policy directive 'style-src
     *    'self' https://accounts.google.com/gsi/style'. Either the 'unsafe-inline' keyword, a hash
     *    ('sha256-RU4sU0AaS8IBGZx8XrGt/pa9A5SLA3dQszGeqT5L3Kw='), or a nonce is required… The action has
     *    been blocked."
     *
     * As quatro diretivas da doc são **necessárias e não suficientes** — foi essa a lacuna.
     *
     * `'unsafe-inline'` em vez dos hashes, e isso é decisão: o `gsi/client` é script de terceiro que o
     * Google atualiza quando quer, e cada versão nova mudaria o hash — o login quebraria em produção,
     * sem aviso, num arquivo que ninguém abre. Hash aqui seria bomba-relógio.
     *
     * O custo, sem enfeite: estilo inline passa a ser permitido na página. **Script não** — o
     * `script-src` continua com allow-list e com o hash do script de tema do `ADR-008`. Quem for
     * apertar esta diretiva de novo precisa saber que ela é o que mantém a entrada do app funcionando.
     */
    expect(style).toContain("'unsafe-inline'");

    // O botão do Google é um iframe de `accounts.google.com` — sem `frame-src`, ele não existe.
    expect(cspDirectives.get('frame-src')).toContain('https://accounts.google.com/gsi/');

    // E a biblioteca conversa com o servidor do Google por `fetch`/XHR.
    expect(cspDirectives.get('connect-src')).toContain('https://accounts.google.com/gsi/');
  });

  it('não autoriza o domínio inteiro do Google no script-src', () => {
    // Autorizar `https://accounts.google.com` inteiro daria ao host que serve o login poder carregar
    // qualquer script dele. O caminho exato da biblioteca é o que a documentação pede.
    const script = cspDirectives.get('script-src') ?? [];
    expect(script).not.toContain('https://accounts.google.com');
    expect(script).not.toContain('https://*.google.com');
  });

  it('não permite câmera, microfone, localização nem pagamento', () => {
    const policy = globalHeaders.get('Permissions-Policy') ?? '';
    for (const recurso of ['camera', 'microphone', 'geolocation', 'payment']) {
      expect(policy).toContain(`${recurso}=()`);
    }
  });

  /*
   * Ambiente privado (ADR-011). O app fala com provedores de IA pagos: não é conteúdo para ser
   * encontrado por busca. Três camadas independentes dizem a mesma coisa de propósito — o cabeçalho
   * vale para toda resposta da Vercel, o `robots.txt` vale para o rastreador educado e a meta tag
   * sobrevive quando o documento é servido por um host que não aplica os cabeçalhos. Se alguém
   * remover uma delas, o teste aponta qual.
   */
  it('recusa indexação, arquivamento e snippet em toda resposta', () => {
    // Diretiva de `X-Robots-Tag` é case-insensitive: a asserção é sobre a diretiva, não sobre a caixa.
    const robots = (globalHeaders.get('X-Robots-Tag') ?? '').toLowerCase();
    for (const diretiva of ['noindex', 'nofollow', 'noarchive']) {
      expect(robots).toContain(diretiva);
    }
  });

  it('publica um robots.txt que bloqueia todos os agentes', () => {
    const file = resolve(process.cwd(), 'public', 'robots.txt');
    expect(existsSync(file)).toBe(true);

    /*
     * Parseia as diretivas em vez de casar a forma da linha. A ABNF do RFC 9309 é case-insensitive
     * (via RFC 5234 §2.3) e admite espaço em volta do valor, então `User-Agent: *` e `Disallow: / `
     * são equivalentes ao que este arquivo escreve. A primeira versão deste teste casava a forma
     * exata e **reprovava arquivo válido** — falso vermelho apontado pelo `rebeca-qa` (QA-A9). A
     * asserção agora é sobre o significado: existe um bloco de todos os agentes e ele bloqueia a raiz.
     */
    const diretivas = readFileSync(file, 'utf8')
      .split(/\r?\n/)
      .map((linha) => linha.replace(/#.*$/, '').trim())
      .filter((linha) => linha.includes(':'))
      .map((linha) => {
        const separador = linha.indexOf(':');
        return {
          campo: linha.slice(0, separador).trim().toLowerCase(),
          valor: linha.slice(separador + 1).trim(),
        };
      });

    expect(diretivas).toContainEqual({ campo: 'user-agent', valor: '*' });
    expect(diretivas).toContainEqual({ campo: 'disallow', valor: '/' });
    // Um `allow` abriria exceção ao bloqueio que o bloco acima promete.
    expect(diretivas.some((diretiva) => diretiva.campo === 'allow')).toBe(false);
  });

  it('repete a recusa no próprio documento, para host que ignore cabeçalhos', () => {
    // Qualquer ordem de atributos é HTML válido: a tag é identificada por ter `name="robots"`.
    const robotsMeta = (html.match(/<meta\b[^>]*>/gi) ?? []).filter((tag) =>
      /\bname\s*=\s*["']?robots["']?/i.test(tag),
    );
    expect(robotsMeta.length).toBe(1);
    expect(robotsMeta[0]).toMatch(/\bcontent\s*=\s*["'][^"']*noindex/i);
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
