/**
 * Camada HTTP da IA — uma implementação, dois consumidores.
 *
 * A mesma função atende o servidor de desenvolvimento (plugin do Vite) e a função serverless da
 * Vercel. Duplicar a lógica nos dois lugares seria a forma mais rápida de ter um comportamento em
 * `pnpm dev` e outro em produção — e o defeito só apareceria depois do deploy.
 *
 * O que esta camada faz, e por quê:
 *
 * - **Limita o tamanho do corpo.** Corpo sem limite é custo escondido e vetor de abuso: um POST de
 *   100 MB entraria no prompt e seria cobrado por token.
 * - **Não vaza segredo no erro.** Erro inesperado vira mensagem genérica em pt-BR; o detalhe técnico
 *   fica no formato do `AiError`, que já é construído sem chave e sem corpo cru do provedor.
 * - **Método e rota explícitos.** `GET /api/ai/generate` é 405, não "tenta mesmo assim".
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import { AiError, type AiErrorBody } from '../../src/ai/contract.js';
import { authorizeRequest, type AuthContext } from '../auth/guard.js';
import { handleGenerate, handleGetSettings, handleSaveSettings, handleStatus, handleTestProvider, redact } from './handler.js';

/**
 * Reexportado para o plugin de desenvolvimento conseguir higienizar o detalhe de um erro sem
 * importar o grafo inteiro do servidor dentro do `vite.config.ts`.
 */
export { redact };

/** Teto do corpo da requisição. Folgado para o maior caso legítimo, apertado contra abuso. */
const MAX_BODY_BYTES = 256 * 1024;

export interface RouteResult {
  readonly status: number;
  readonly body: unknown;
}

/** Lê e decodifica o corpo JSON, respeitando o teto de tamanho. */
export async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;

  for await (const chunk of req) {
    const buffer = typeof chunk === 'string' ? Buffer.from(chunk) : (chunk as Buffer);
    size += buffer.length;
    if (size > MAX_BODY_BYTES) {
      throw new AiError(
        {
          code: 'entrada-invalida',
          message: 'O pedido é grande demais para ser processado.',
          retryable: false,
        },
        413,
      );
    }
    chunks.push(buffer);
  }

  if (chunks.length === 0) return undefined;
  const text = Buffer.concat(chunks).toString('utf8').trim();
  if (text.length === 0) return undefined;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new AiError(
      { code: 'entrada-invalida', message: 'O corpo do pedido não é JSON válido.', retryable: false },
      400,
    );
  }
}

/** Escreve a resposta JSON com `no-store`: resposta de IA não é cacheável por intermediário. */
export function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body ?? {});
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(payload);
}

/** Converte qualquer exceção no corpo de erro do contrato — sem stack, sem segredo. */
function toErrorResponse(error: unknown): RouteResult {
  if (error instanceof AiError) {
    return { status: error.status, body: error.toBody() };
  }
  const body: AiErrorBody = {
    code: 'provedor',
    message: 'Algo falhou ao falar com a camada de IA. Nada foi publicado.',
    retryable: true,
  };
  return { status: 500, body };
}

/**
 * Leitura do corpo da requisição, **adiada**.
 *
 * Por que uma função e não o corpo já lido: quem lê o corpo decide a resposta quando ele é inválido.
 * Com a leitura feita **antes** da guarda (como estava), uma requisição **sem credencial nenhuma**
 * recebia `400 entrada-invalida` — o contrato publicado deixava de ser "401 sem identidade" e passava
 * a depender do corpo, e quem não se identificou ainda fazia o processo alocar e analisar até 256 KB.
 * Achado do `rebeca-qa` (`QA-014`), com reprodução: `src/auth/__tests__/qa-refutacao.test.tsx`.
 *
 * Adiando a leitura, a guarda é a primeira coisa que roda em **qualquer** caminho, e o corpo só é
 * tocado depois de a identidade estar provada e autorizada.
 */
export type CorpoDaRequisicao = () => Promise<unknown>;

/**
 * Opções do roteador de IA.
 *
 * `authorization` é o header cru da requisição; a guarda (`../auth/guard.js`) decide o que fazer com
 * ele. `now` e `verify` existem para os testes fixarem o relógio e verificarem token sem rede.
 */
export interface AiRouteOptions extends AuthContext {
  readonly now?: Date;
}

/** Rotas desta API que **gastam dinheiro** — recebem o limite de uso mais apertado. */
const ROTAS_QUE_GASTAM: readonly string[] = ['/api/ai/generate', '/api/ai/test'];

/**
 * Roteia a chamada. É o único ponto que decide o que existe e o que não existe na API de IA — e,
 * desde o `ADR-014`, também o único ponto em que **toda** rota desta API passa pela guarda de
 * identidade. Ela vem antes do roteamento **e antes de ler o corpo**: uma rota nova escrita amanhã
 * nasce protegida por estar atrás desta linha, e não por alguém lembrar de protegê-la.
 */
export async function routeAiRequest(
  method: string,
  pathname: string,
  lerCorpo: CorpoDaRequisicao,
  options: AiRouteOptions = {},
): Promise<RouteResult> {
  try {
    const auth = await authorizeRequest({
      ...options,
      costly: ROTAS_QUE_GASTAM.includes(pathname),
    });
    if (!auth.ok) return { status: auth.status, body: auth.body };

    if (pathname === '/api/ai/status') {
      if (method !== 'GET') {
        throw new AiError(
          { code: 'entrada-invalida', message: 'Este endereço responde apenas a GET.', retryable: false },
          405,
        );
      }
      return { status: 200, body: handleStatus(options.now ?? new Date()) };
    }

    if (pathname === '/api/ai/generate') {
      if (method !== 'POST') {
        throw new AiError(
          { code: 'entrada-invalida', message: 'Este endereço responde apenas a POST.', retryable: false },
          405,
        );
      }
      return {
        status: 200,
        body: await handleGenerate(await lerCorpo(), {
          ...(options.now === undefined ? {} : { now: options.now }),
          identity: auth.identity,
        }),
      };
    }

    /*
     * Configuração de IA: segredos, endereços e escolha de modelo.
     *
     * A LEITURA nunca devolve valor de chave — só máscara e indicador de presença (ver
     * `buildSettingsView`). A ESCRITA continua recusada quando o app está publicado
     * (`settingsWritable()`), mesmo com autenticação ligada: quem entra passa a **usar** a chave, não
     * a **ver** nem a **trocar**. O lugar do segredo é o gerenciador do servidor.
     */
    if (pathname === '/api/ai/settings') {
      if (method === 'GET') {
        return { status: 200, body: handleGetSettings() };
      }
      if (method === 'PUT' || method === 'POST') {
        return { status: 200, body: handleSaveSettings(await lerCorpo(), options.now ?? new Date()) };
      }
      throw new AiError(
        { code: 'entrada-invalida', message: 'Este endereço responde a GET e PUT.', retryable: false },
        405,
      );
    }

    if (pathname === '/api/ai/test') {
      if (method !== 'POST') {
        throw new AiError(
          { code: 'entrada-invalida', message: 'Este endereço responde apenas a POST.', retryable: false },
          405,
        );
      }
      return {
        status: 200,
        body: await handleTestProvider(await lerCorpo(), options.now ?? new Date(), auth.identity),
      };
    }

    throw new AiError(
      { code: 'funcao-desconhecida', message: 'Endereço de IA desconhecido.', retryable: false },
      404,
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
