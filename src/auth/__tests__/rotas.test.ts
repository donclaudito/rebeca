/**
 * Prova de que a guarda está **no caminho de todas as rotas** — e de que ela é a mesma nos dois
 * pontos de entrada (servidor de desenvolvimento e função serverless).
 *
 * O defeito que este arquivo existe para impedir não é sutil: uma rota nova, ou um ponto de entrada
 * que esqueça de repassar o header, transforma "app privado" em "app público que gasta a chave paga".
 * A verificação é por rota, uma por uma, com a lista lida do próprio `ADR-014`: 4 de `api/ai/*` e 5 de
 * `api/media/*` (as quatro leituras/gerações mais `file`, que serve a arte).
 *
 * E a prova que mais importa: **sem credencial, nada é cobrado**. Não basta responder 401; o livro de
 * custos não pode ganhar linha nenhuma — é o invariante nº 4 conferido no único momento em que ele
 * pode ser violado de verdade.
 */

import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { routeAiRequest } from '../../../server/ai/http.js';
import { AiError } from '../../ai/contract.js';
import { routeMediaRequest } from '../../../server/media/http.js';
import { routeAuthRequest } from '../../../server/auth/http.js';
import { resetRateLimits, AUTH_RATE_LIMIT, AUTH_RATE_LIMIT_PAID } from '../../../server/auth/rate-limit.js';
import { resetMemoryLedger } from '../../../server/ai/ledger.js';
import {
  CLIENT_ID_DE_TESTE,
  SUB_AUTORIZADO,
  SUB_NAO_AUTORIZADO,
  autenticacaoDeTeste,
  isolarAmbiente,
  payloadDeTeste,
} from './test-support.js';

let restaurarAmbiente: () => void;
let pastaTemporaria: string;
let livro: string;

beforeEach(() => {
  restaurarAmbiente = isolarAmbiente();
  pastaTemporaria = mkdtempSync(join(tmpdir(), 'rebeca-auth-'));
  livro = join(pastaTemporaria, 'custos.csv');
  process.env['GOOGLE_CLIENT_ID'] = CLIENT_ID_DE_TESTE;
  process.env['REBECA_ALLOWED_SUBS'] = SUB_AUTORIZADO;
  process.env['REBECA_COST_LEDGER'] = livro;
  resetRateLimits();
  resetMemoryLedger();
});

afterEach(() => {
  restaurarAmbiente();
  resetRateLimits();
  resetMemoryLedger();
  rmSync(pastaTemporaria, { recursive: true, force: true });
});

/** As rotas protegidas, como o `ADR-014` as enumera. Sem token, **todas** recusam. */
const ROTAS_PROTEGIDAS: ReadonlyArray<{
  readonly nome: string;
  readonly chamar: (opcoes: unknown) => Promise<{ status: number; body?: unknown }>;
}> = [
  {
    nome: 'GET /api/ai/status',
    chamar: (opcoes) => routeAiRequest('GET', '/api/ai/status', async () => undefined, opcoes as never),
  },
  {
    nome: 'POST /api/ai/generate',
    chamar: (opcoes) => routeAiRequest('POST', '/api/ai/generate', async () => ({}), opcoes as never),
  },
  {
    nome: 'GET /api/ai/settings',
    chamar: (opcoes) => routeAiRequest('GET', '/api/ai/settings', async () => undefined, opcoes as never),
  },
  {
    nome: 'POST /api/ai/test',
    chamar: (opcoes) => routeAiRequest('POST', '/api/ai/test', async () => ({}), opcoes as never),
  },
  {
    nome: 'GET /api/media/episodes',
    chamar: (opcoes) =>
      routeMediaRequest('GET', '/api/media/episodes', new URLSearchParams({ channelId: 'luna' }), undefined, opcoes as never),
  },
  {
    nome: 'GET /api/media/episode',
    chamar: (opcoes) =>
      routeMediaRequest(
        'GET',
        '/api/media/episode',
        new URLSearchParams({ channelId: 'luna', episodeId: 'luna-ep-001' }),
        undefined,
        opcoes as never,
      ),
  },
  {
    nome: 'GET /api/media/custos',
    chamar: (opcoes) =>
      routeMediaRequest(
        'GET',
        '/api/media/custos',
        new URLSearchParams({ channelId: 'luna', contentId: 'qualquer' }),
        undefined,
        opcoes as never,
      ),
  },
  {
    nome: 'GET /api/media/file',
    chamar: (opcoes) =>
      routeMediaRequest(
        'GET',
        '/api/media/file',
        new URLSearchParams({ channelId: 'luna', episodeId: 'luna-ep-001', asset: 'x.png' }),
        undefined,
        opcoes as never,
      ),
  },
  {
    nome: 'POST /api/media/thumbnails',
    chamar: (opcoes) =>
      routeMediaRequest(
        'POST',
        '/api/media/thumbnails',
        new URLSearchParams(),
        async () => ({ channelId: 'luna', episodeId: 'luna-ep-001' }),
        opcoes as never,
      ),
  },
];

describe('nenhuma rota protegida responde sem identidade', () => {
  for (const rota of ROTAS_PROTEGIDAS) {
    it(`${rota.nome} recusa sem token`, async () => {
      const resultado = await rota.chamar({});
      expect(resultado.status).toBe(401);
      expect((resultado.body as { code?: string }).code).toBe('token-ausente');
    });
  }

  it('o token de uma conta fora da lista não abre nenhuma delas', async () => {
    const estranho = autenticacaoDeTeste(payloadDeTeste({ sub: SUB_NAO_AUTORIZADO }));
    for (const rota of ROTAS_PROTEGIDAS) {
      const resultado = await rota.chamar(estranho);
      expect(resultado.status).toBe(403);
      expect((resultado.body as { code?: string }).code).toBe('conta-nao-autorizada');
    }
  });
});

describe('sem identidade, nada é cobrado', () => {
  it('a geração de thumbnail recusada não escreve no livro de custos', async () => {
    const resultado = await routeMediaRequest(
      'POST',
      '/api/media/thumbnails',
      new URLSearchParams(),
      async () => ({ channelId: 'luna', episodeId: 'luna-ep-001' }),
      {},
    );

    expect(resultado.status).toBe(401);
    // A prova: o pipeline de thumbnail roda portões de gasto e grava custo. Se ele tivesse rodado,
    // haveria linha no livro — mesmo com provedor simulado, que registra custo zero.
    expect(existsSync(livro)).toBe(false);
  });

  it('a geração de IA recusada não escreve no livro de custos', async () => {
    const resultado = await routeAiRequest('POST', '/api/ai/generate', async () => ({
      functionId: 'criar-seo',
      channelId: 'luna',
      input: {},
    }));

    expect(resultado.status).toBe(401);
    expect(existsSync(livro)).toBe(false);
  });

  it('o 403 também não cobra', async () => {
    const estranho = autenticacaoDeTeste(payloadDeTeste({ sub: SUB_NAO_AUTORIZADO }));
    const resultado = await routeAiRequest(
      'POST',
      '/api/ai/generate',
      async () => ({ functionId: 'criar-seo', channelId: 'luna', input: {} }),
      estranho,
    );

    expect(resultado.status).toBe(403);
    expect(existsSync(livro)).toBe(false);
  });

  it('o corpo NÃO é lido quando a identidade é recusada (defeito 1 do QA-014)', async () => {
    /*
     * A ordem importa por dois motivos, e os dois foram medidos pelo `rebeca-qa`: o contrato publicado
     * ("401 sem identidade") não pode depender do corpo, e quem não se identificou não pode fazer o
     * processo alocar e analisar até 256 KB. Este caso falha se alguém voltar a ler o corpo antes.
     */
    let leuOCorpo = false;
    const resultado = await routeAiRequest('POST', '/api/ai/generate', async () => {
      leuOCorpo = true;
      return { functionId: 'criar-seo', channelId: 'luna', input: {} };
    });

    expect(resultado.status).toBe(401);
    expect(leuOCorpo).toBe(false);
  });

  it('com identidade, corpo grande demais preserva o 413 — não vira 400', async () => {
    // Antes, o `catch` da casca reescrevia **qualquer** erro de leitura como 400, e o 413 do
    // `readJsonBody` sumia. Agora o erro nasce dentro do roteador e o status do `AiError` é preservado.
    const resultado = await routeAiRequest(
      'POST',
      '/api/ai/generate',
      async () => {
        throw new AiError(
          { code: 'entrada-invalida', message: 'O pedido é grande demais para ser processado.', retryable: false },
          413,
        );
      },
      autenticacaoDeTeste(),
    );

    expect(resultado.status).toBe(413);
  });
});

describe('com identidade autorizada, as rotas continuam respondendo', () => {
  it('GET /api/ai/status responde 200', async () => {
    const resultado = await routeAiRequest('GET', '/api/ai/status', async () => undefined, autenticacaoDeTeste());
    expect(resultado.status).toBe(200);
  });

  it('GET /api/media/episodes responde 200 para o canal', async () => {
    const resultado = await routeMediaRequest(
      'GET',
      '/api/media/episodes',
      new URLSearchParams({ channelId: 'luna' }),
      undefined,
      autenticacaoDeTeste(),
    );
    expect(resultado.status).toBe(200);
  });

  it('a recusa de método continua sendo 405, e não 401', async () => {
    // A guarda vem antes, então sem token o 405 vira 401 — correto: não se revela o contrato da rota
    // a quem não se identificou. **Com** identidade, o 405 é o que a rota sempre respondeu.
    const resultado = await routeAiRequest('POST', '/api/ai/status', async () => undefined, autenticacaoDeTeste());
    expect(resultado.status).toBe(405);
  });

  it('rota inexistente com identidade válida continua 404', async () => {
    const resultado = await routeAiRequest(
      'GET',
      '/api/ai/nao-existe',
      async () => undefined,
      autenticacaoDeTeste(),
    );
    expect(resultado.status).toBe(404);
  });
});

describe('as duas cotas de uso são independentes', () => {
  it('estourar a cota de leitura não consome a de geração', async () => {
    /*
     * Achado 3 do `QA-014`: antes, leitura e geração dividiam um contador só, e desenhar uma tela com
     * 13 prévias aproximava a identidade do teto — com `429` em `GET`, que não gasta nada. Agora há
     * duas cotas, com chaves separadas.
     */
    const auth = autenticacaoDeTeste();
    for (let i = 0; i < AUTH_RATE_LIMIT.limit; i += 1) {
      await routeAiRequest('GET', '/api/ai/status', async () => undefined, auth);
    }
    // A leitura seguinte é recusada…
    expect((await routeAiRequest('GET', '/api/ai/status', async () => undefined, auth)).status).toBe(429);
    // …e a cota de geração continua inteira: a leitura não a consumiu.
    const geracao = await routeAiRequest('POST', '/api/ai/generate', async () => ({}), auth);
    expect(geracao.status).not.toBe(429);
  });

  it('a cota de geração é mais apertada e conta em separado', async () => {
    const auth = autenticacaoDeTeste();
    for (let i = 0; i < AUTH_RATE_LIMIT_PAID.limit; i += 1) {
      const resultado = await routeAiRequest('POST', '/api/ai/generate', async () => ({}), auth);
      // Sem chave configurada a geração é simulada — o que importa aqui é que a guarda **deixa passar**
      // (não é 429) até o limite.
      expect(resultado.status).not.toBe(429);
    }
    const excedente = await routeAiRequest('POST', '/api/ai/generate', async () => ({}), auth);
    expect(excedente.status).toBe(429);
  });
});

describe('rotas de autenticação', () => {
  it('GET /api/auth/config é pública e devolve o Client ID', async () => {
    const resultado = await routeAuthRequest('GET', '/api/auth/config');
    expect(resultado.status).toBe(200);
    const corpo = resultado.body as { clientId?: string; googleScriptUrl?: string };
    expect(corpo.clientId).toBe(CLIENT_ID_DE_TESTE);
    expect(corpo.googleScriptUrl).toBe('https://accounts.google.com/gsi/client');
  });

  it('a configuração pública não devolve a lista nem a CONTAGEM de autorizados', async () => {
    // A contagem saiu da rota pública no `QA-014`: quantas identidades têm acesso é informação sobre
    // quem tem acesso, e um visitante anônimo não tem uso para ela. Ficou só em `/api/auth/me`.
    const resultado = await routeAuthRequest('GET', '/api/auth/config');
    const serializado = JSON.stringify(resultado.body);
    expect(serializado).not.toContain(SUB_AUTORIZADO);
    expect(serializado).not.toContain('allowedIdentities');
    expect(serializado).not.toContain('identities');
  });

  it('sem Client ID configurado, a configuração diz isso em vez de mentir', async () => {
    delete process.env['GOOGLE_CLIENT_ID'];
    const resultado = await routeAuthRequest('GET', '/api/auth/config');
    expect(resultado.status).toBe(200);
    expect((resultado.body as { clientId: string | null }).clientId).toBeNull();
  });

  it('GET /api/auth/me exige token', async () => {
    const resultado = await routeAuthRequest('GET', '/api/auth/me');
    expect(resultado.status).toBe(401);
  });

  it('GET /api/auth/me responde à conta **não autorizada**, para ela poder se autorizar', async () => {
    const estranho = autenticacaoDeTeste(payloadDeTeste({ sub: SUB_NAO_AUTORIZADO }));
    const resultado = await routeAuthRequest('GET', '/api/auth/me', estranho);

    expect(resultado.status).toBe(200);
    const corpo = resultado.body as { authorized?: boolean; identity?: { sub?: string }; allowedIdentities?: number };
    expect(corpo.authorized).toBe(false);
    // É por este campo que o dono descobre o que colar em REBECA_ALLOWED_SUBS.
    expect(corpo.identity?.sub).toBe(SUB_NAO_AUTORIZADO);
    // E é aqui — só depois de o token ser verificado — que a contagem de autorizados aparece.
    expect(corpo.allowedIdentities).toBe(1);
  });
  it('GET /api/auth/me reconhece a conta autorizada', async () => {
    const resultado = await routeAuthRequest('GET', '/api/auth/me', autenticacaoDeTeste());
    expect(resultado.status).toBe(200);
    expect((resultado.body as { authorized?: boolean }).authorized).toBe(true);
  });

  it('as rotas de autenticação só respondem a GET', async () => {
    expect((await routeAuthRequest('POST', '/api/auth/config')).status).toBe(405);
    expect((await routeAuthRequest('DELETE', '/api/auth/me')).status).toBe(405);
    expect((await routeAuthRequest('GET', '/api/auth/desconhecida')).status).toBe(404);
  });
});

/* =============================================================================
   O encanamento: o header precisa atravessar a função serverless
   ============================================================================= */

interface RespostaFalsa {
  readonly statusCode: number;
  readonly headers: Record<string, string>;
  readonly corpo: string;
}

function respostaFalsa(): { res: ServerResponse; ler: () => RespostaFalsa } {
  const headers: Record<string, string> = {};
  let corpo = '';
  const res = {
    statusCode: 0,
    setHeader: (chave: string, valor: string) => {
      headers[chave.toLowerCase()] = valor;
    },
    end: (valor?: string) => {
      corpo = valor ?? '';
    },
  } as unknown as ServerResponse;

  return { res, ler: () => ({ statusCode: res.statusCode, headers, corpo }) };
}

describe('o header atravessa a função serverless', () => {
  it('api/media/episodes.ts recusa 401 quando a requisição não traz credencial', async () => {
    const { default: handler } = await import('../../../api/media/episodes.js');
    const req = {
      method: 'GET',
      url: '/api/media/episodes?channelId=luna',
      headers: {},
    } as unknown as IncomingMessage;
    const { res, ler } = respostaFalsa();

    await handler(req, res);

    const resposta = ler();
    expect(resposta.statusCode).toBe(401);
    expect(JSON.parse(resposta.corpo).code).toBe('token-ausente');
  });

  it('api/media/file.ts recusa 401 quando a requisição não traz credencial', async () => {
    /*
     * Esta função **não existia** antes do `ADR-014`: o caminho era atendido só pelo plugin do Vite e,
     * em produção, cairia no rewrite de SPA devolvendo HTML com status 200. O caso garante que a
     * função criada não é uma casca sem guarda — e que não devolve HTML.
     */
    const { default: handler } = await import('../../../api/media/file.js');
    const req = {
      method: 'GET',
      url: '/api/media/file?channelId=luna&episodeId=luna-ep-001&asset=thumb.png',
      headers: {},
    } as unknown as IncomingMessage;
    const { res, ler } = respostaFalsa();

    await handler(req, res);

    const resposta = ler();
    expect(resposta.statusCode).toBe(401);
    expect(JSON.parse(resposta.corpo).code).toBe('token-ausente');
  });

  it('api/auth/config.ts responde 200 sem credencial — é pública por desenho', async () => {
    const { default: handler } = await import('../../../api/auth/config.js');
    const req = { method: 'GET', url: '/api/auth/config', headers: {} } as unknown as IncomingMessage;
    const { res, ler } = respostaFalsa();

    await handler(req, res);

    const resposta = ler();
    expect(resposta.statusCode).toBe(200);
    expect(JSON.parse(resposta.corpo).clientId).toBe(CLIENT_ID_DE_TESTE);
  });

  it('api/auth/me.ts carrega e recusa quem não traz credencial', async () => {
    /*
     * O que este caso cobre, e o que ele **não** cobre — declarado, para não virar falsa confiança:
     *
     * - cobre: a função serverless carrega (o import relativo com `.js` resolve no runtime da Vercel,
     *   que é o defeito que já derrubou a IA com HTTP 500) e a rota não responde 200 sem credencial;
     * - **não** cobre: o caminho completo com token de verdade, porque isso exigiria a chave pública
     *   do Google pela rede — e teste que depende de rede é teste que falha por motivo alheio ao
     *   produto. O caminho de verificação é exercitado, com o verificador injetado, em `guard.test.ts`
     *   e nos casos de `routeAuthRequest` acima.
     */
    const { default: handler } = await import('../../../api/auth/me.js');
    const req = { method: 'GET', url: '/api/auth/me', headers: {} } as unknown as IncomingMessage;
    const { res, ler } = respostaFalsa();

    await handler(req, res);

    const resposta = ler();
    expect(resposta.statusCode).toBe(401);
    expect(JSON.parse(resposta.corpo).code).toBe('token-ausente');
  });
});
