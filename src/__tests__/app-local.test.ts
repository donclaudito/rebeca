/**
 * O servidor do app instalado (`ADR-016`) — verificação **por HTTP de verdade**.
 *
 * ## Por que este teste sobe um servidor em vez de chamar funções
 *
 * O que este arquivo protege não é uma função: é a **existência de um caminho**. Antes do `ADR-016`, o
 * app só respondia por duas portas (o middleware do Vite e as funções da Vercel), e `dist/` sozinho não
 * tinha API nenhuma. Um teste que chamasse `resolveStaticFile` direto passaria com o servidor
 * desconectado dos roteadores — que é justamente o defeito que se quer impedir. Então aqui se abre uma
 * porta, se faz um pedido HTTP e se lê a resposta, igual ao que o navegador do dono faz.
 *
 * ## O que ele **não** depende
 *
 * - **Do `dist/` construído.** O CI roda `pnpm test` **antes** de `pnpm build`; um teste que exigisse
 *   `dist/` reprovaria numa árvore limpa. A raiz é temporária e montada aqui — com o `index.html` e o
 *   `vercel.json` **reais**, copiados do repositório, porque é a política de segurança de verdade que
 *   o modo local tem de respeitar (contrato do `ADR-008`).
 * - **De navegador.** Não há navegador automatizado neste projeto; o que se verifica é status,
 *   cabeçalho e byte. Fidelidade visual continua sendo olho humano.
 *
 * ## O segredo sentinela
 *
 * A raiz temporária recebe um `.rebeca/segredos/llm.json` com um valor único. Nenhuma resposta deste
 * servidor pode conter esse valor: é a forma barata de provar que a contenção de caminho vale para o
 * arquivo que mais importa (a chave de IA, em texto claro no disco).
 */

import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { request as httpRequest } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_HOST, DEFAULT_PORT, isLoopback, readHost, readPort } from '../../server/local/defaults.js';
import { patternToRegExp, stripDirectives } from '../../server/local/security-headers.js';
import { createLocalServer } from '../../server/local/server.js';
import { looksLikeAsset, resolveWithin } from '../../server/local/static-files.js';

const SEGREDO = 'sentinela-que-nao-pode-sair-do-servidor';
const repositorio = process.cwd();

let servidor: Server;
let raiz: string;
let porta: number;
let clientIdOriginal: string | undefined;
let rootOriginal: string | undefined;

interface Resposta {
  readonly status: number;
  readonly headers: Record<string, string | string[] | undefined>;
  readonly texto: string;
}

function pedir(
  method: string,
  caminho: string,
  opcoes: { readonly authorization?: string; readonly corpo?: string } = {},
): Promise<Resposta> {
  return new Promise((resolver, rejeitar) => {
    const headers: Record<string, string> = {};
    if (opcoes.authorization !== undefined) headers['authorization'] = opcoes.authorization;
    if (opcoes.corpo !== undefined) headers['content-type'] = 'application/json';

    const requisicao = httpRequest({ host: '127.0.0.1', port: porta, method, path: caminho, headers }, (resposta) => {
      const partes: Buffer[] = [];
      resposta.on('data', (parte: Buffer) => partes.push(parte));
      resposta.on('end', () => {
        resolver({
          status: resposta.statusCode ?? 0,
          headers: resposta.headers,
          texto: Buffer.concat(partes).toString('utf8'),
        });
      });
    });

    requisicao.on('error', rejeitar);
    if (opcoes.corpo !== undefined) requisicao.write(opcoes.corpo);
    requisicao.end();
  });
}

/** Hash do script inline, calculado como o navegador faz — o mesmo contrato do `headers.test.ts`. */
function hashDoScriptInline(documento: string): string[] {
  const corpos: string[] = [];
  const padrao = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
  let casado: RegExpExecArray | null;
  while ((casado = padrao.exec(documento)) !== null) corpos.push(casado[1]!);
  return corpos.map((corpo) => `'sha256-${createHash('sha256').update(corpo, 'utf8').digest('base64')}'`);
}

beforeAll(async () => {
  raiz = mkdtempSync(join(tmpdir(), 'rebeca-app-local-'));
  mkdirSync(join(raiz, 'dist', 'assets'), { recursive: true });
  mkdirSync(join(raiz, '.rebeca', 'segredos'), { recursive: true });

  // Casca e política **reais**: é a política do repositório que o modo local precisa respeitar.
  copyFileSync(join(repositorio, 'index.html'), join(raiz, 'dist', 'index.html'));
  copyFileSync(join(repositorio, 'vercel.json'), join(raiz, 'vercel.json'));
  writeFileSync(join(raiz, 'dist', 'assets', 'app-abc123.js'), 'console.log("app");\n');
  writeFileSync(join(raiz, 'dist', 'icone-32.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]));
  writeFileSync(join(raiz, '.env'), 'GOOGLE_CLIENT_ID=nao-deve-sair\nREBECA_ALLOWED_SUBS=1\n');
  writeFileSync(join(raiz, '.rebeca', 'segredos', 'llm.json'), JSON.stringify({ openai: { apiKey: SEGREDO } }));

  rootOriginal = process.env['REBECA_ROOT'];
  clientIdOriginal = process.env['GOOGLE_CLIENT_ID'];
  process.env['GOOGLE_CLIENT_ID'] = 'client-id-de-teste.apps.googleusercontent.com';

  servidor = createLocalServer({ root: raiz });
  await new Promise<void>((pronto) => servidor.listen(0, '127.0.0.1', pronto));
  porta = (servidor.address() as AddressInfo).port;
});

afterAll(async () => {
  await new Promise<void>((pronto) => servidor.close(() => pronto()));
  rmSync(raiz, { recursive: true, force: true });

  if (rootOriginal === undefined) delete process.env['REBECA_ROOT'];
  else process.env['REBECA_ROOT'] = rootOriginal;

  if (clientIdOriginal === undefined) delete process.env['GOOGLE_CLIENT_ID'];
  else process.env['GOOGLE_CLIENT_ID'] = clientIdOriginal;
});

describe('arquivos do app', () => {
  it('serve a casca em /', async () => {
    const resposta = await pedir('GET', '/');
    expect(resposta.status).toBe(200);
    expect(resposta.headers['content-type']).toContain('text/html');
    expect(resposta.texto).toContain('<div id="root"></div>');
  });

  /**
   * O app usa `BrowserRouter`: `/c/luna/inicio` **não existe** como arquivo. Sem este *fallback*, quem
   * recarrega a página numa tela de canal recebe 404 — e é o defeito que, na versão publicada, a
   * Vercel resolve com o rewrite do `vercel.json`.
   */
  it('responde rota de página funda com a casca (fallback de SPA)', async () => {
    const resposta = await pedir('GET', '/c/luna/revisao?aberto=luna-ep-001');
    expect(resposta.status).toBe(200);
    expect(resposta.headers['content-type']).toContain('text/html');
    expect(resposta.texto).toContain('<div id="root"></div>');
  });

  /**
   * A regra que separa "página" de "arquivo". Devolver a casca com 200 num asset ausente é o defeito
   * que já apareceu neste projeto como `Unexpected token <` e como painel carregando para sempre.
   */
  it('asset que não existe é 404 em JSON, nunca a casca', async () => {
    const resposta = await pedir('GET', '/assets/nao-existe.js');
    expect(resposta.status).toBe(404);
    expect(resposta.headers['content-type']).toContain('application/json');
    expect(resposta.texto).not.toContain('<div id="root">');
  });

  it('serve asset existente com o tipo do nome do arquivo', async () => {
    const script = await pedir('GET', '/assets/app-abc123.js');
    expect(script.status).toBe(200);
    expect(script.headers['content-type']).toContain('text/javascript');

    const imagem = await pedir('GET', '/icone-32.png');
    expect(imagem.status).toBe(200);
    expect(imagem.headers['content-type']).toBe('image/png');
  });

  it('engessa o cache do asset e não cacheia a casca', async () => {
    const script = await pedir('GET', '/assets/app-abc123.js');
    expect(String(script.headers['cache-control'])).toContain('immutable');

    // Casca cacheada serviria HTML velho apontando para asset que já não existe — "atualizei o app e
    // ele abriu em branco".
    const casca = await pedir('GET', '/');
    expect(String(casca.headers['cache-control'])).toContain('no-store');
  });

  it('responde HEAD como GET, sem corpo', async () => {
    const resposta = await pedir('HEAD', '/');
    expect(resposta.status).toBe(200);
    expect(resposta.headers['content-type']).toContain('text/html');
    expect(resposta.texto).toBe('');
  });

  it('recusa método que não seja GET/HEAD no arquivo', async () => {
    const resposta = await pedir('POST', '/');
    expect(resposta.status).toBe(405);
    expect(resposta.headers['content-type']).toContain('application/json');
  });
});

/**
 * A defesa que mais importa neste arquivo. A raiz do app guarda `.env` e `.rebeca/segredos/llm.json` —
 * a chave paga, em texto claro. Um servidor de arquivos com contenção frouxa entrega isso a quem pedir
 * `/%2e%2e%2f.env`, e a variante percent-encoded é a que passa por checagem ingênua de `..`.
 */
describe('contenção de caminho', () => {
  const tentativas = [
    '/%2e%2e%2f.env',
    '/%2e%2e%2f%2e%2e%2f.env',
    '/..%2f..%2fvercel.json',
    '/assets/../../.env',
    '/%2e%2e%2f.rebeca%2fsegredos%2fllm.json',
    '/.env',
    '/.rebeca/segredos/llm.json',
    '/vercel.json',
  ];

  for (const caminho of tentativas) {
    it(`não entrega nada para ${caminho}`, async () => {
      const resposta = await pedir('GET', caminho);
      expect(resposta.status).toBe(404);
      expect(resposta.texto).not.toContain(SEGREDO);
      expect(resposta.texto).not.toContain('nao-deve-sair');
      expect(resposta.texto).not.toContain('rewrites');
    });
  }

  it('recusa URI malformada e byte nulo sem derrubar o servidor', async () => {
    const malformada = await pedir('GET', '/%zz');
    expect(malformada.status).toBe(404);

    // Byte nulo trunca caminho em APIs do sistema operacional: `index.html%00.png` passaria por uma
    // checagem de extensão ingênua.
    const comNulo = await pedir('GET', '/index.html%00.png');
    expect(comNulo.status).toBe(404);

    // E o servidor continua vivo depois das duas.
    const vivo = await pedir('GET', '/');
    expect(vivo.status).toBe(200);
  });
});

describe('API no servidor local', () => {
  it('rota de API desconhecida é 404 em JSON, nunca a casca', async () => {
    const resposta = await pedir('GET', '/api/nao-existe');
    expect(resposta.status).toBe(404);
    expect(resposta.headers['content-type']).toContain('application/json');
    expect(resposta.texto).toContain('rota-desconhecida');
    expect(resposta.texto).not.toContain('<div id="root">');
  });

  /**
   * A guarda do `ADR-014` mora **dentro** dos roteadores — e é exatamente por isso que este plugue novo
   * nasce protegido. Se ela morasse em cada ponto de entrada, o servidor local teria sido a porta aberta
   * para a chave paga.
   */
  it('exige identidade nas rotas de IA, mídia e configuração', async () => {
    for (const caminho of ['/api/ai/status', '/api/media/episodes?channelId=luna', '/api/ai/settings']) {
      const resposta = await pedir('GET', caminho);
      expect(resposta.status, `${caminho} deveria exigir identidade`).toBe(401);
    }
  });

  /**
   * Ordem das checagens, e não só presença: sem credencial, o corpo **nem é lido**. Com a leitura antes
   * da guarda, quem não se identificou receberia `400 corpo-invalido` — e o processo ainda analisaria o
   * corpo de um desconhecido (achado 1 do `QA-014`).
   */
  it('recusa por identidade antes de olhar o corpo', async () => {
    const resposta = await pedir('POST', '/api/ai/generate', { corpo: 'isto não é json' });
    expect(resposta.status).toBe(401);
    expect(resposta.texto).toContain('token-ausente');

    const midia = await pedir('POST', '/api/media/thumbnails', { corpo: '{"channelId":"luna"}' });
    expect(midia.status).toBe(401);
  });

  it('token inválido também é 401, sem vazar o motivo técnico ao usuário', async () => {
    const resposta = await pedir('GET', '/api/ai/status', { authorization: 'Bearer token-de-mentira' });
    expect(resposta.status).toBe(401);
    expect(resposta.texto).toContain('token-invalido');
    expect(resposta.texto).not.toContain('client-id-de-teste');
  });

  /**
   * `GET /api/auth/config` é a única rota pública desta API, por necessidade: é dela que o navegador
   * tira o Client ID para desenhar o botão de entrada. Ela não abre nada — a lista de `sub`s não sai.
   */
  it('mantém pública apenas a configuração de autenticação', async () => {
    const resposta = await pedir('GET', '/api/auth/config');
    expect(resposta.status).toBe(200);
    expect(resposta.texto).toContain('client-id-de-teste');
    expect(resposta.texto).not.toContain('REBECA_ALLOWED_SUBS');
  });

  it('sem GOOGLE_CLIENT_ID a API falha fechada (503), não abre', async () => {
    const guardado = process.env['GOOGLE_CLIENT_ID'];
    delete process.env['GOOGLE_CLIENT_ID'];
    try {
      const resposta = await pedir('GET', '/api/ai/status');
      expect(resposta.status).toBe(503);
      expect(resposta.texto).toContain('autenticacao-nao-configurada');
    } finally {
      process.env['GOOGLE_CLIENT_ID'] = guardado;
    }
  });
});

describe('cabeçalhos de segurança', () => {
  it('aplica os cabeçalhos do vercel.json na resposta', async () => {
    const { headers } = await pedir('GET', '/');
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['cross-origin-opener-policy']).toBe('same-origin-allow-popups');
    expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(String(headers['permissions-policy'])).toContain('camera=()');
    expect(String(headers['x-robots-tag'])).toContain('noindex');
  });

  /**
   * As duas subtrações do modo local, com o motivo no `ADR-016`: HTTPS não existe aqui, e
   * `upgrade-insecure-requests` reescreveria as chamadas do próprio app para `https://127.0.0.1:…`.
   * O resto do CSP — inclusive o hash do script de tema — tem de continuar valendo: sem ele o tema
   * pisca, e sem as quatro diretivas do Google o botão de entrada não funciona.
   */
  it('tira do CSP só o que não faz sentido em HTTP local', async () => {
    const { headers } = await pedir('GET', '/');
    const csp = String(headers['content-security-policy']);

    expect(csp).not.toContain('upgrade-insecure-requests');
    expect(headers['strict-transport-security']).toBeUndefined();

    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain('https://accounts.google.com/gsi/client');
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toContain("script-src 'self' 'unsafe-inline'");

    const autorizados = hashDoScriptInline(readFileSync(join(raiz, 'dist', 'index.html'), 'utf8'));
    expect(autorizados.length).toBeGreaterThan(0);
    for (const hash of autorizados) expect(csp).toContain(hash);
  });

  it('escuta só no loopback por padrão', async () => {
    expect((servidor.address() as AddressInfo).address).toBe('127.0.0.1');
    expect(DEFAULT_HOST).toBe('127.0.0.1');
  });
});

/** Funções puras de apoio — as que decidem caminho e padrão de origem, onde um erro não aparece na tela. */
describe('peças puras do servidor', () => {
  it('resolveWithin recusa sair da raiz', () => {
    const base = join(tmpdir(), 'rebeca-base');
    expect(resolveWithin(base, '/assets/app.js')).toBe(join(base, 'assets', 'app.js'));
    expect(resolveWithin(base, '/../fora.txt')).toBeNull();
    expect(resolveWithin(base, '/assets/../../fora.txt')).toBeNull();
  });

  it('distingue rota de página de arquivo', () => {
    expect(looksLikeAsset('/assets/app-abc123.js')).toBe(true);
    expect(looksLikeAsset('/favicon.ico')).toBe(true);
    expect(looksLikeAsset('/c/luna/inicio')).toBe(false);
    expect(looksLikeAsset('/')).toBe(false);
    // Sem barra final: pasta vira arquivo? Não — só o ponto no último segmento decide.
    expect(looksLikeAsset('/c/luna')).toBe(false);
  });

  it('converte o padrão de origem do vercel.json em expressão regular', () => {
    const global = patternToRegExp('/(.*)');
    expect(global.test('/qualquer/coisa')).toBe(true);

    const assets = patternToRegExp('/assets/(.*)');
    expect(assets.test('/assets/app.js')).toBe(true);
    expect(assets.test('/assets/')).toBe(true);
    expect(assets.test('/outro/app.js')).toBe(false);
    expect(assets.test('/assets')).toBe(false);
  });

  it('remove diretiva do CSP preservando as outras', () => {
    const politica = "default-src 'self'; upgrade-insecure-requests; frame-ancestors 'none'";
    const resultado = stripDirectives(politica, ['upgrade-insecure-requests']);
    expect(resultado).toBe("default-src 'self'; frame-ancestors 'none'");
    // Diretiva que não está na lista não some por acidente.
    expect(stripDirectives(politica, ['inexistente'])).toContain('upgrade-insecure-requests');
  });

  it('lê porta e host do ambiente sem aceitar lixo', () => {
    expect(readPort(undefined)).toBe(DEFAULT_PORT);
    expect(readPort('  9000 ')).toBe(9000);
    expect(readPort('')).toBe(DEFAULT_PORT);
    expect(() => readPort('8787abc')).toThrow(/REBECA_PORT/);
    expect(() => readPort('0')).toThrow(/REBECA_PORT/);
    expect(() => readPort('70000')).toThrow(/REBECA_PORT/);

    expect(readHost(undefined)).toBe('127.0.0.1');
    expect(readHost('  ')).toBe('127.0.0.1');
    expect(readHost('0.0.0.0')).toBe('0.0.0.0');
    expect(isLoopback('127.0.0.1')).toBe(true);
    expect(isLoopback('0.0.0.0')).toBe(false);
  });
});
