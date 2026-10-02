/**
 * Cliente da leitura de mídia no navegador.
 *
 * O navegador só pergunta **do canal** e recebe o que existe no disco do servidor. Ele não monta caminho
 * de arquivo, não conhece `.rebeca/assets` e não decide o que é "gerado" — isso é do servidor, que é
 * quem consegue medir o disco. Aqui só há transporte e tradução de erro.
 *
 * O tratamento de erro copia de propósito o da camada de IA (`src/ai/client.ts`), porque o defeito que
 * ele cobre já aconteceu de verdade uma vez: se o servidor de desenvolvimento foi iniciado antes de a
 * rota existir, `/api/media/...` cai no fallback de SPA e devolve **HTML com status 200**. Sem a
 * checagem, a tela mostraria "carregando" para sempre ou "não foi possível carregar" sem dizer por quê.
 */

import type { ContentCostView, MediaEpisodeView, MediaLibraryView, ThumbnailRunView } from './view';
import { notifySessionLost, requireAuthHeaders } from '../auth/token';

const BASE = '/api/media';

/** Erro de leitura com o motivo em pt-BR, pronto para a tela exibir. */
export class MediaReadError extends Error {
  readonly code: string;
  readonly retryable: boolean;

  constructor(code: string, message: string, retryable = false) {
    super(message);
    this.name = 'MediaReadError';
    this.code = code;
    this.retryable = retryable;
  }
}

/** Mensagem em pt-BR vinda do corpo do erro, com um texto de reserva. */
function mensagemDoCorpo(body: unknown, reserva: string): string {
  const record = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
  return typeof record['message'] === 'string' ? record['message'] : reserva;
}

/** Código do erro vindo do servidor (`canal-obrigatorio`, `conta-nao-autorizada`, …). */
function codigoDoCorpo(body: unknown): string {
  const record = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
  return typeof record['code'] === 'string' ? record['code'] : 'leitura-de-midia';
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  let headers: Record<string, string>;
  try {
    headers = {
      accept: 'application/json',
      ...requireAuthHeaders(),
      ...((init?.headers as Record<string, string> | undefined) ?? {}),
    };
  } catch {
    // Leitura de mídia também exige identidade (`ADR-014`): a arte de um canal não é pública.
    throw new MediaReadError(
      'sem-sessao',
      'Sua sessão terminou. Entre de novo com a sua conta Google para ver a mídia gerada.',
    );
  }

  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, { ...init, headers });
  } catch {
    throw new MediaReadError(
      'rede',
      'Não foi possível alcançar o servidor do app. Verifique a conexão e tente de novo.',
      true,
    );
  }

  let body: unknown = null;
  let parsed = false;
  try {
    body = await response.json();
    parsed = true;
  } catch {
    parsed = false;
  }

  /*
   * 401 derruba a sessão em memória — a credencial não vale mais e insistir só repetiria o erro.
   * 403 **não** derruba: a conta está autenticada e apenas fora da lista de acesso; o app precisa
   * continuar mostrando a tela que explica como autorizá-la.
   */
  if (response.status === 401) {
    notifySessionLost();
    throw new MediaReadError(
      'token-invalido',
      mensagemDoCorpo(body, 'Sua credencial não foi aceita. Entre de novo com a sua conta Google.'),
    );
  }

  if (!response.ok) {
    throw new MediaReadError(
      codigoDoCorpo(body),
      mensagemDoCorpo(body, 'Não foi possível ler a mídia gerada neste ambiente.'),
      response.status >= 500,
    );
  }

  if (!parsed) {
    const looksLikeHtml = response.headers.get('content-type')?.includes('text/html') ?? false;
    throw new MediaReadError(
      'sem-json',
      looksLikeHtml
        ? 'O endereço de mídia respondeu com a página do app em vez de dados. Isso normalmente significa que o servidor está rodando uma versão anterior às rotas de mídia — pare o servidor e rode `pnpm dev` de novo, então recarregue a página.'
        : 'O servidor respondeu em um formato que o app não entende.',
      true,
    );
  }

  return body as T;
}

/**
 * O que existe de mídia para o canal.
 *
 * Nunca lança por "não há mídia": ausência é resposta legítima (`available: false` + motivo). O erro
 * fica reservado para falha de leitura de verdade — misturar os dois faria uma tela vazia parecer um
 * defeito.
 */
export function fetchMediaLibrary(channelId: string): Promise<MediaLibraryView> {
  return requestJson<MediaLibraryView>(`/episodes?channelId=${encodeURIComponent(channelId)}`);
}

/** Um episódio por inteiro, com cada ativo e se ele ainda está no disco. */
export function fetchMediaEpisode(channelId: string, episodeId: string): Promise<MediaEpisodeView> {
  return requestJson<MediaEpisodeView>(
    `/episode?channelId=${encodeURIComponent(channelId)}&episodeId=${encodeURIComponent(episodeId)}`,
  );
}

/**
 * URL do arquivo em si.
 *
 * **Não vai direto no `src` de uma `<img>`** desde o `ADR-014`: a rota exige o cabeçalho
 * `Authorization`, e o navegador não manda cabeçalho em `src`. Quem renderiza arte é `MediaImage`
 * (`src/auth/MediaImage.tsx`), que busca a URL por `fetch`, converte em `blob:` e exibe.
 *
 * O servidor só serve o que **está no manifesto** daquele episódio daquele canal; um caminho
 * inventado devolve 404. A defesa contra travessia mora lá (`findManifestAsset`), nunca aqui.
 */
export function mediaFileUrl(channelId: string, episodeId: string, pathFromAssets: string): string {
  const params = new URLSearchParams({ channelId, episodeId, asset: pathFromAssets });
  return `${BASE}/file?${params.toString()}`;
}

/**
 * Gera as opções de thumbnail de um episódio.
 *
 * É a única chamada de mídia que pode **gastar dinheiro**, e ela não decide nada sozinha: o servidor roda
 * a allow-list do canal, a idempotência (o que já existe não é gerado de novo) e o teto mensal antes de
 * qualquer chamada ao provedor. Se o provedor estiver fora da lista, a resposta é 403 com o fundamento e a
 * URL do termo — não um erro genérico.
 */
export function generateEpisodeThumbnails(
  channelId: string,
  episodeId: string,
  contexto: ThumbnailContext = {},
): Promise<ThumbnailRunView> {
  return requestJson<ThumbnailRunView>('/thumbnails', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ channelId, episodeId, ...contexto }),
  });
}

/**
 * O que a tela sabe e o servidor não: personagens oficiais do canal, tema, título e paleta.
 *
 * Vai no corpo porque **o dado vive na camada de dados do app** — o servidor não deve importar dado de
 * exemplo para dentro do próprio bundle. Sem isto, o prompt saía de textos fixos no código, descrevendo um
 * personagem que não era o do canal e afirmando que a ficha não existia.
 */
export interface ThumbnailContext {
  readonly personagens?: ReadonlyArray<{ name: string; role: string; sheetVersion?: string }>;
  readonly tema?: string;
  readonly titulo?: string;
  readonly paleta?: readonly string[];
}

/**
 * Quanto este conteúdo custou **de verdade** — somado do livro, no servidor.
 *
 * A tela mostrava o `costUsd` do arquivo de exemplo com o rótulo "Custo real". Este é o caminho que
 * substitui o número inventado pelo lançado. Nunca lança por "nada gasto": ausência de linha é resposta
 * legítima (`rows: 0`), e "não deu para somar" é `ledgerAvailable: false` com motivo — que é diferente de
 * zero e a tela diz isso.
 */
export function fetchContentCost(channelId: string, contentId: string): Promise<ContentCostView> {
  const params = new URLSearchParams({ channelId, contentId });
  return requestJson<ContentCostView>(`/custos?${params.toString()}`);
}
