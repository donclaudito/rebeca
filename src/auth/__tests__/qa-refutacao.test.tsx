/**
 * QA-014 — reprodução mínima dos defeitos encontrados na revisão adversarial da autenticação
 * (`ADR-014`), escrita pelo `rebeca-qa`.
 *
 * Este arquivo nasceu com duas partes, e a diferença entre elas era deliberada:
 *
 * 1. **`REFUTA:`** — casos que **falhavam** contra o código entregue. Cada um é a reprodução mínima de
 *    um defeito; o `expect` descreve o comportamento **correto** e o comentário registra o que foi
 *    observado. Um destes testes passando é o sinal de que o defeito foi corrigido.
 * 2. **"o que NÃO consegui refutar"** — casos que **passavam**, e que ficam no repositório como
 *    registro do ataque que foi tentado e resistiu. Eles existem para dar confiança onde nada foi
 *    derrubado; não são enfeite.
 *
 * **Estado atual: verde.** Os dois defeitos foram corrigidos por quem produziu, e os casos da parte 1
 * passaram a medir a correção — não foram removidos nem afrouxados. A parte 1 continua valendo como
 * teste de regressão: se a leitura do corpo voltar para antes da guarda, ou se a prévia voltar a
 * aceitar `200 text/html`, eles ficam vermelhos de novo.
 *
 * Como rodar (o sandbox confinado bloqueia o `exec('net use')` que o Vite faz ao carregar o
 * `vite.config.ts`; fora dele, `pnpm exec vitest run src/auth/__tests__/qa-refutacao.test.ts`):
 *
 *     pnpm exec vitest run src/auth/__tests__/qa-refutacao.test.ts
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MediaImage } from '../MediaImage';
import { authorizeRequest, bearerToken } from '../../../server/auth/guard.js';
import { resetRateLimits, AUTH_RATE_LIMIT } from '../../../server/auth/rate-limit.js';
import {
  CLIENT_ID_DE_TESTE,
  SUB_AUTORIZADO,
  SUB_NAO_AUTORIZADO,
  TOKEN_DE_TESTE,
  autenticacaoDeTeste,
  isolarAmbiente,
  payloadDeTeste,
  verificadorDeTeste,
} from './test-support.js';

let restaurarAmbiente: () => void;

beforeEach(() => {
  restaurarAmbiente = isolarAmbiente();
  process.env['GOOGLE_CLIENT_ID'] = CLIENT_ID_DE_TESTE;
  process.env['REBECA_ALLOWED_SUBS'] = SUB_AUTORIZADO;
  resetRateLimits();
});

afterEach(() => {
  restaurarAmbiente();
  resetRateLimits();
});

/* =============================================================================
   Apoio: uma requisição e uma resposta falsas, como as que a Vercel entrega
   ============================================================================= */

function requisicaoFalsa(opcoes: {
  readonly method: string;
  readonly url: string;
  readonly headers?: Record<string, string>;
  readonly body?: string;
}): IncomingMessage {
  const body = opcoes.body ?? '';
  return {
    method: opcoes.method,
    url: opcoes.url,
    headers: opcoes.headers ?? {},
    [Symbol.asyncIterator](): AsyncIterator<Buffer> {
      let entregue = false;
      return {
        next: async () =>
          entregue ? { done: true, value: undefined } : ((entregue = true), { done: false, value: Buffer.from(body) }),
      };
    },
  } as unknown as IncomingMessage;
}

function respostaFalsa(): { res: ServerResponse; ler: () => { statusCode: number; corpo: string } } {
  const estado = { statusCode: 0, corpo: '' };
  const res = {
    set statusCode(valor: number) {
      estado.statusCode = valor;
    },
    get statusCode() {
      return estado.statusCode;
    },
    setHeader: () => undefined,
    end: (valor?: string) => {
      estado.corpo = valor ?? '';
    },
  } as unknown as ServerResponse;
  return { res, ler: () => estado };
}

/* =============================================================================
   REFUTA 1 — a guarda NÃO é a primeira coisa executada nas rotas que leem corpo
   =============================================================================

   O critério 1 do `ADR-014` diz: "sem header `Authorization` → **401** em todas as rotas". Nas
   funções serverless que leem o corpo, `readJsonBody(req)` roda **antes** de `routeAiRequest`/
   `routeMediaRequest` — e é ele quem decide a resposta quando o corpo é inválido. Resultado medido:
   uma requisição **sem credencial nenhuma** recebe **400** (`entrada-invalida` / `corpo-invalido`) em
   vez de 401, e um corpo acima do teto recebe 400 (o `413` do `AiError` é reescrito para 400 no
   `catch` do próprio handler).

   Por que importa, ainda que não cobre nada: (a) o contrato publicado deixa de ser "401 sem
   identidade" e passa a depender do corpo; (b) quem não se identificou faz o processo alocar e
   analisar até 256 KB de corpo antes de qualquer checagem — superfície de trabalho não autenticada.
   A correção é chamar a guarda **antes** de ler o corpo (ou mover a leitura para dentro do roteador).
   ============================================================================= */

type Handler = (req: IncomingMessage, res: ServerResponse) => Promise<void>;

const CASCAS_QUE_LEEM_CORPO: ReadonlyArray<{
  readonly nome: string;
  readonly carregar: () => Promise<{ default: Handler }>;
  readonly method: string;
  readonly url: string;
}> = [
  {
    nome: 'api/ai/generate.ts',
    carregar: () => import('../../../api/ai/generate.js'),
    method: 'POST',
    url: '/api/ai/generate',
  },
  { nome: 'api/ai/test.ts', carregar: () => import('../../../api/ai/test.js'), method: 'POST', url: '/api/ai/test' },
  {
    nome: 'api/ai/settings.ts (PUT)',
    carregar: () => import('../../../api/ai/settings.js'),
    method: 'PUT',
    url: '/api/ai/settings',
  },
  {
    nome: 'api/media/thumbnails.ts',
    carregar: () => import('../../../api/media/thumbnails.js'),
    method: 'POST',
    url: '/api/media/thumbnails',
  },
];

describe('REFUTA (defeito 1): sem Authorization, a resposta tem de ser 401 — não 400', () => {
  for (const casca of CASCAS_QUE_LEEM_CORPO) {
    it(`${casca.nome}: corpo inválido e NENHUMA credencial → 401`, async () => {
      const { default: handler } = await casca.carregar();
      const req = requisicaoFalsa({ method: casca.method, url: casca.url, headers: {}, body: '{nao-e-json' });
      const { res, ler } = respostaFalsa();

      await handler(req, res);

      // Observado hoje: 400 com `entrada-invalida`/`corpo-invalido` — a guarda nem foi consultada.
      expect(ler().statusCode).toBe(401);
      expect(JSON.parse(ler().corpo).code).toBe('token-ausente');
    });
  }

  it('api/ai/generate.ts: corpo acima do teto (300 KB) sem credencial → 401', async () => {
    const { default: handler } = (await import('../../../api/ai/generate.js')) as {
      default: (req: IncomingMessage, res: ServerResponse) => Promise<void>;
    };
    const req = requisicaoFalsa({
      method: 'POST',
      url: '/api/ai/generate',
      headers: {},
      body: JSON.stringify({ lixo: 'x'.repeat(300 * 1024) }),
    });
    const { res, ler } = respostaFalsa();

    await handler(req, res);

    // Observado hoje: 400 "O pedido é grande demais para ser processado." (o 413 vira 400 no catch).
    expect(ler().statusCode).toBe(401);
  });

  it('controle: sem credencial e SEM corpo, a mesma casca responde 401 (o defeito é a ordem)', async () => {
    const { default: handler } = (await import('../../../api/media/episodes.js')) as {
      default: (req: IncomingMessage, res: ServerResponse) => Promise<void>;
    };
    const req = requisicaoFalsa({ method: 'GET', url: '/api/media/episodes?channelId=luna', headers: {} });
    const { res, ler } = respostaFalsa();

    await handler(req, res);

    expect(ler().statusCode).toBe(401);
  });
});

/* =============================================================================
   REFUTA 2 — a prévia da arte trata "200 com HTML" como imagem válida
   =============================================================================

   `MediaImage` decide sucesso apenas por `response.ok`. Um corpo que **não é imagem** com status 200
   (o caso clássico deste projeto: o rewrite de SPA devolvendo `index.html`; ou um deploy em que a
   função `/api/media/file` não subiu) passa pela checagem, vira `blob:` e é entregue ao `<img>`. O
   usuário vê imagem quebrada **sem nenhuma das mensagens** que o componente existe para dar — que é
   exatamente o defeito que a classe `MediaImage` diz corrigir.

   O contraste que mostra que o projeto sabe fazer isso: `src/auth/client.ts` e `src/media/client.ts`
   conferem `content-type: text/html` e lançam `sem-json` com uma explicação acionável. Aqui não há
   checagem alguma de tipo.

   A correção: exigir tipo de imagem (`response.headers.get('content-type')?.startsWith('image/')`)
   antes de `createObjectURL`, caindo no estado de falha quando não for.
   ============================================================================= */

describe('REFUTA (defeito 2): 200 com HTML não pode virar prévia de imagem', () => {
  beforeEach(() => {
    Object.defineProperty(URL, 'createObjectURL', {
      writable: true,
      configurable: true,
      value: vi.fn(() => 'blob:conteudo-nao-imagem'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', { writable: true, configurable: true, value: vi.fn() });
  });

  it('resposta 200 com text/html cai no aviso de falha, não num <img> de HTML', async () => {
    const { setAccessToken } = await import('../token');
    setAccessToken('token-de-teste');
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response('<!doctype html><html><body><div id="root"></div></body></html>', {
            status: 200,
            headers: { 'content-type': 'text/html; charset=utf-8' },
          }),
      ),
    );

    const { unmount } = render(<MediaImage src="/api/media/file?channelId=luna&episodeId=e&asset=a.png" alt="Prévia" />);

    // Observado hoje: nenhum aviso aparece — o componente renderiza
    // `<img src="blob:conteudo-nao-imagem">` e o navegador mostra o ícone de imagem quebrada.
    const aviso = await screen.findByRole('img', { name: /não foi possível carregar/i });
    expect(aviso).toBeInTheDocument();

    unmount();
    vi.unstubAllGlobals();
  });
});

/* =============================================================================
   O que NÃO consegui refutar — o ataque que foi tentado e resistiu
   ============================================================================= */

describe('o que NÃO consegui refutar (registro do ataque)', () => {
  it('as formas de header que o Node produz na prática recusam com 401', async () => {
    // Duplicidade de header: o Node junta os dois valores com ", " antes de chegar ao handler.
    expect(bearerToken(`Bearer ${TOKEN_DE_TESTE}, Bearer ${TOKEN_DE_TESTE}`)).toBeNull();
    // `req.headers.authorization` pode chegar como array em alguns runtimes: não é string, não passa.
    expect(bearerToken([TOKEN_DE_TESTE] as unknown as string)).toBeNull();
    // Espaço não-quebrável não é separador válido do esquema.
    expect(bearerToken(`Bearer\u00a0${TOKEN_DE_TESTE}`)).toBeNull();
    // Bearer sem valor, esquema errado e token cru.
    expect(bearerToken('Bearer')).toBeNull();
    expect(bearerToken('Basic dXNlcjpzZW5oYQ==')).toBeNull();
    expect(bearerToken(TOKEN_DE_TESTE)).toBeNull();
  });

  it('token maior que o teto é recusado SEM consultar o verificador', async () => {
    let consultou = false;
    const espiao = async (): Promise<never> => {
      consultou = true;
      throw new Error('não deveria ser consultado');
    };
    const resultado = await authorizeRequest({
      authorization: `Bearer ${'a'.repeat(9005)}`,
      verify: espiao,
    });
    expect(resultado.ok).toBe(false);
    expect(consultou).toBe(false);
  });

  it('a guarda precede o roteamento: rota inexistente sem token é 401, não 404', async () => {
    const { routeAiRequest } = await import('../../../server/ai/http.js');
    const semToken = await routeAiRequest('GET', '/api/ai/inventada', async () => undefined, {});
    const comToken = await routeAiRequest(
      'GET',
      '/api/ai/inventada',
      async () => undefined,
      autenticacaoDeTeste(),
    );
    expect(semToken.status).toBe(401);
    expect(comToken.status).toBe(404);
  });

  it('o 403 não consome cota nem revela a lista de autorizados', async () => {
    const estranho = autenticacaoDeTeste(payloadDeTeste({ sub: SUB_NAO_AUTORIZADO }));
    for (let i = 0; i < AUTH_RATE_LIMIT.limit + 5; i += 1) {
      const r = await authorizeRequest(estranho);
      if (r.ok) throw new Error('conta fora da lista não deveria ser autorizada');
      expect(r.status).toBe(403);
    }
    // A conta autorizada continua com a cota inteira: quem não pode usar nada não gasta memória.
    expect((await authorizeRequest(autenticacaoDeTeste())).ok).toBe(true);

    const recusa = await authorizeRequest(estranho);
    if (recusa.ok) throw new Error('conta fora da lista não deveria ser autorizada');
    expect(recusa.body.message).toContain(SUB_NAO_AUTORIZADO);
    expect(recusa.body.message).not.toContain(SUB_AUTORIZADO);
  });

  it('a mensagem crua da biblioteca do Google não atravessa o corpo do erro', async () => {
    const vazamento = new Error(`Invalid token signature: ${TOKEN_DE_TESTE}`);
    const resultado = await authorizeRequest({
      authorization: `Bearer ${TOKEN_DE_TESTE}`,
      verify: verificadorDeTeste(payloadDeTeste(), vazamento),
    });
    if (resultado.ok) throw new Error('token com erro do verificador não deveria passar');
    expect(JSON.stringify(resultado.body)).not.toContain(TOKEN_DE_TESTE);
    expect(JSON.stringify(resultado.body)).not.toContain('Invalid token signature');
  });
});
