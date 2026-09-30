/**
 * Cliente da camada de IA no navegador.
 *
 * O navegador **não** conhece provedor, modelo nem chave. Ele manda `functionId + channelId + input`
 * e recebe o resultado já validado, com o custo real. Toda a decisão de "qual LLM" fica no servidor
 * (`server/ai/handler.ts`), que é o que torna o invariante nº 7 verdadeiro na prática e não só no
 * documento.
 */

import { AiError, type AiErrorBody, type AiRequest, type AiResult, type AiStatus } from './contract';

const BASE = '/api/ai';

/** Converte uma resposta de erro do servidor no `AiError` do domínio. */
function toAiError(status: number, body: unknown): AiError {
  const record = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
  const code = typeof record['code'] === 'string' ? record['code'] : 'provedor';
  const message =
    typeof record['message'] === 'string'
      ? record['message']
      : 'Não foi possível falar com a camada de IA. Nada foi gerado.';
  const detail = typeof record['detail'] === 'string' ? record['detail'] : undefined;
  const retryable = record['retryable'] === true;

  return new AiError(
    detail === undefined
      ? { code: code as AiErrorBody['code'], message, retryable }
      : { code: code as AiErrorBody['code'], message, detail, retryable },
    status,
  );
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
    });
  } catch {
    // Erro de rede: a mensagem não acusa o usuário nem sugere que o conteúdo foi gerado.
    throw new AiError(
      {
        code: 'provedor',
        message: 'Não foi possível alcançar o servidor do app. Verifique a conexão e tente de novo.',
        retryable: true,
      },
      0,
    );
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok) throw toAiError(response.status, body);
  return body as T;
}

/** Estado do provedor: quem está configurado, qual modelo atende cada função e o teto em vigor. */
export function fetchAiStatus(): Promise<AiStatus> {
  return requestJson<AiStatus>('/status');
}

/** Executa uma função de IA. O `channelId` vai sempre no corpo — não existe chamada sem canal. */
export function generate(request: AiRequest): Promise<AiResult> {
  return requestJson<AiResult>('/generate', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export { AiError };
export type { AiResult, AiStatus, AiRequest };
