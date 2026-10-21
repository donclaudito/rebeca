/**
 * Cabeçalhos de segurança do servidor **local** — lidos do `vercel.json`, não recriados aqui.
 *
 * ## A decisão
 *
 * Existe **uma** política de segurança neste projeto, e ela mora no `vercel.json`. O
 * `src/__tests__/headers.test.ts` já a vigia: confere que o hash do script inline do `index.html` é
 * exatamente o que o CSP autoriza (contrato do `ADR-008`), que não há `unsafe-inline` em `script-src`
 * e que as quatro diretivas do Google Identity Services estão lá — sem elas **a entrada do app não
 * funciona** (medido no console do navegador, registrado no próprio teste).
 *
 * Escrever uma segunda política para o modo local seria a forma mais rápida de o app instalado passar
 * a divergir do app publicado — e o defeito apareceria só na máquina de quem instalou, que é o pior
 * lugar para descobrir. Então o servidor local **lê o mesmo arquivo** e aplica as mesmas regras.
 *
 * ## As duas subtrações, e por que só duas
 *
 * `ADR-016` decidiu que o modo local é HTTP puro em `127.0.0.1`. Duas diretivas do `vercel.json`
 * existem por causa de HTTPS e **quebrariam** aqui:
 *
 * 1. `upgrade-insecure-requests` manda o navegador reescrever toda requisição insegura para HTTPS. O
 *    app fala com a própria origem (`/api/ai/...`): reescrita, toda chamada viraria
 *    `https://127.0.0.1:8787/...` e falharia. A isenção de `localhost` **não é comportamento
 *    padronizado** — há pedido aberto para excluí-lo (<https://lists.w3.org/Archives/Public/public-webapps-github/2024Oct/0412.html>)
 *    e bug aberto no WebKit (<https://wiki.webkit.org/show_bug.cgi?id=250776>), ou seja, o resultado
 *    depende do motor e da versão. Não é coisa em que se apoiar: a diretiva sai.
 * 2. `Strict-Transport-Security` só tem efeito sobre HTTPS. Mantê-lo num servidor que não é HTTPS seria
 *    um cabeçalho que mente sobre a superfície.
 *
 * Todo o resto — `nosniff`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`,
 * `Cross-Origin-Opener-Policy`, `X-Robots-Tag` e o CSP inteiro — é aplicado **igual** ao publicado.
 * Se alguém acrescentar uma diretiva de segurança no `vercel.json`, o modo local a herda de graça.
 */

import { existsSync, readFileSync, statSync } from 'node:fs';

export interface HeaderEntry {
  readonly key: string;
  readonly value: string;
}

export interface HeaderRule {
  readonly source: string;
  readonly headers: readonly HeaderEntry[];
}

interface ConfigShape {
  readonly headers?: readonly { readonly source?: unknown; readonly headers?: unknown }[];
}

interface Cache {
  readonly path: string;
  readonly mtimeMs: number;
  readonly rules: readonly HeaderRule[];
}

let cache: Cache | null = null;

/** Lê as regras do `vercel.json`, com cache por `mtime` (o arquivo não muda durante a execução). */
export function readHeaderRules(configPath: string): readonly HeaderRule[] {
  if (!existsSync(configPath)) return [];

  try {
    const { mtimeMs } = statSync(configPath);
    if (cache !== null && cache.path === configPath && cache.mtimeMs === mtimeMs) return cache.rules;

    const parsed = JSON.parse(readFileSync(configPath, 'utf8')) as ConfigShape;
    const rules: HeaderRule[] = [];
    for (const rule of parsed.headers ?? []) {
      if (typeof rule.source !== 'string' || !Array.isArray(rule.headers)) continue;
      const headers = (rule.headers as unknown[]).flatMap((entry) => {
        if (typeof entry !== 'object' || entry === null) return [];
        const { key, value } = entry as { key?: unknown; value?: unknown };
        if (typeof key !== 'string' || typeof value !== 'string') return [];
        return [{ key, value }];
      });
      rules.push({ source: rule.source, headers });
    }

    cache = { path: configPath, mtimeMs, rules };
    return rules;
  } catch {
    /*
     * Arquivo ilegível não pode derrubar o servidor **nem** deixá-lo sem cabeçalho nenhum em silêncio.
     * Devolver `[]` significa "nenhuma regra casou": a resposta sai sem os cabeçalhos extras, e o
     * servidor de desenvolvimento (que não os aplica) é o piso conhecido. Quem avisa é o `cli.ts`, na
     * subida, e não uma exceção no meio de uma requisição.
     */
    return [];
  }
}

/**
 * Converte o padrão de origem da Vercel (`/(.*)`, `/assets/(.*)`) em expressão regular.
 *
 * O `(.*)` é o único curinga que este projeto usa. Em vez de escapar tudo e depois desescapar o
 * curinga — que é onde esse tipo de função costuma errar —, o padrão é **quebrado** no curinga e cada
 * pedaço literal é escapado por inteiro.
 */
export function patternToRegExp(source: string): RegExp {
  const body = source
    .split('(.*)')
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('(.*)');
  return new RegExp(`^${body}$`);
}

/** Diretivas que o modo local **não** pode emitir. Ver o comentário de topo deste arquivo. */
const DIRECTIVES_DROPPED_LOCALLY = ['upgrade-insecure-requests'];
const HEADERS_DROPPED_LOCALLY = ['strict-transport-security'];

const CSP_HEADER = 'content-security-policy';

/** Tira diretivas do CSP preservando o resto. Exportada para o teste poder refutar a subtração. */
export function stripDirectives(policy: string, directives: readonly string[]): string {
  return policy
    .split(';')
    .map((part) => part.trim())
    .filter((part) => {
      if (part.length === 0) return false;
      const name = part.split(/\s+/)[0]?.toLowerCase() ?? '';
      return !directives.includes(name);
    })
    .join('; ');
}

/**
 * Cabeçalhos que valem para um caminho, já com as subtrações do modo local.
 *
 * Regras que casam são aplicadas **na ordem do arquivo**, como na Vercel (a mais específica primeiro,
 * a global por último) — então a última a escrever uma chave é a geral, exatamente como acontece lá.
 */
export function localHeadersFor(pathname: string, rules: readonly HeaderRule[]): Map<string, string> {
  const result = new Map<string, string>();

  for (const rule of rules) {
    if (!patternToRegExp(rule.source).test(pathname)) continue;
    for (const { key, value } of rule.headers) result.set(key.toLowerCase(), value);
  }

  for (const dropped of HEADERS_DROPPED_LOCALLY) result.delete(dropped);

  const csp = result.get(CSP_HEADER);
  if (csp !== undefined) result.set(CSP_HEADER, stripDirectives(csp, DIRECTIVES_DROPPED_LOCALLY));

  return result;
}
