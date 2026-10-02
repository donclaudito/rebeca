/**
 * Roteamento HTTP da mídia gerada — a **mesma** função para a Vercel e para o servidor de
 * desenvolvimento.
 *
 * Por que uma função só, e não lógica dentro da função serverless: é a lição que o projeto já pagou uma
 * vez com a camada de IA. Se o roteamento morasse em `api/`, o dev server precisaria de uma segunda
 * implementação — e as duas divergiriam em silêncio, com o sintoma aparecendo só em produção (o 500 do
 * `ERR_MODULE_NOT_FOUND` foi exatamente isso). Aqui `api/media/*.ts` e o plugin do Vite chamam **este**
 * arquivo.
 *
 * Duas regras que vêm da camada de IA e valem igual:
 *
 * 1. **Sem canal não há resposta.** Todo pedido exige `channelId` (400 `canal-obrigatorio`). Não existe
 *    leitura de mídia "de todos os canais": isso seria o invariante nº 2 furado pela porta da frente.
 * 2. **Erro é JSON, nunca HTML.** O cliente do navegador trata resposta sem JSON como "servidor rodando
 *    versão anterior" e explica isso ao usuário; devolver HTML aqui trocaria um diagnóstico por um
 *    "Unexpected token <".
 */

import { readFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { extname } from 'node:path';
import { ChannelScopeError } from './paths.js';
import { loadChannelMediaSpec } from './channel-spec.js';
import { contentSpend } from './ledger.js';
import { findManifestAsset, readEpisodeView, readLibrary } from './library.js';
import {
  generateThumbnails,
  opcoesPara,
  providerForThumbnails,
  type ContextoDeThumbnail,
  type PersonagemDoCanal,
} from './thumbnails.js';
import { ProviderNotAllowedError } from './allow-list.js';
import { MediaBudgetError } from '../../src/media/limits.js';
import { authorizeRequest, type AuthContext } from '../auth/guard.js';

/**
 * Lê o corpo JSON da requisição.
 *
 * Tem teto de tamanho de propósito: pedido sem limite é memória do servidor entregue a quem chamar. Aqui
 * o único corpo aceito é uma lista curta de opções, então 64 KB é folga larga.
 */
export async function readJsonBody(req: IncomingMessage, limitBytes = 65_536): Promise<unknown> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
    total += buffer.length;
    if (total > limitBytes) {
      throw new Error(`Corpo da requisição acima de ${limitBytes} bytes.`);
    }
    chunks.push(buffer);
  }
  if (total === 0) return undefined;
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
}

export interface MediaHttpResult {
  readonly status: number;
  readonly body?: unknown;
  /** Preenchido quando a resposta é um arquivo do manifesto, não JSON. */
  readonly file?: { readonly absolutePath: string; readonly contentType: string };
}

interface MediaErrorBody {
  readonly code: string;
  readonly message: string;
}

/**
 * Tipo de conteúdo por extensão.
 *
 * Lista fechada de propósito: extensão desconhecida **não** é servida como `application/octet-stream`
 * adivinhado — vira `text/plain`, que o navegador não executa nem interpreta. Um arquivo do pipeline com
 * extensão inesperada é defeito de pipeline, e o lugar de descobrir isso não é o navegador de quem opera.
 */
const CONTENT_TYPE: Readonly<Record<string, string>> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.wav': 'audio/wav',
  '.srt': 'text/plain; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

function fail(status: number, code: string, message: string): MediaHttpResult {
  const body: MediaErrorBody = { code, message };
  return { status, body };
}

/**
 * Responde em JSON.
 *
 * `no-store` é deliberado: manifesto e arquivos mudam quando o pipeline roda, e uma tela que mostra
 * "13 ativos" em cache depois de uma execução nova é a mesma mentira de antes, só que mais difícil de
 * perceber.
 */
export function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(body));
}

/**
 * Responde o que a rota devolveu — JSON **ou** arquivo.
 *
 * Existe para os três pontos de entrada (as duas funções da Vercel e o plugin do Vite) não precisarem
 * saber que existe mais de uma forma de resposta. Quando só havia JSON, cada um chamava `sendJson`
 * direto; com arquivo no meio, a decisão tem de morar num lugar só — senão o dia em que um deles
 * esquecer o caso do arquivo, o navegador recebe JSON no lugar da imagem e a tela mostra imagem quebrada
 * sem dizer por quê.
 */
export function sendMediaResult(res: ServerResponse, result: MediaHttpResult): void {
  if (result.file === undefined) {
    sendJson(res, result.status, result.body);
    return;
  }

  let bytes: Buffer;
  try {
    bytes = readFileSync(result.file.absolutePath);
  } catch {
    // O arquivo estava no manifesto e sumiu entre a checagem e a leitura: 404 honesto, não 500.
    sendJson(res, 404, { code: 'arquivo-sumiu', message: 'O arquivo estava no manifesto mas não pôde ser lido agora.' });
    return;
  }

  res.statusCode = result.status;
  res.setHeader('content-type', result.file.contentType);
  res.setHeader('content-length', String(bytes.length));
  res.setHeader('cache-control', 'no-store');
  // `inline` para o navegador exibir em vez de baixar: quem abre a tela quer ver a thumbnail, não salvar
  // um arquivo com nome de hash.
  res.setHeader('content-disposition', 'inline');
  // O conteúdo do pipeline nunca deve ser interpretado como documento ativo.
  res.setHeader('x-content-type-options', 'nosniff');
  res.end(bytes);
}

/** `channelId`/`episodeId` chegam de query string: string vazia e espaço em branco não contam como valor. */
function token(value: string | null): string | null {
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

/**
 * Lê o contexto do conteúdo do corpo da requisição — **sem confiar em forma**.
 *
 * Um campo com tipo errado é **descartado**, não propagado: o prompt é montado a partir disto, e deixar
 * passar um objeto no lugar de string faria o prompt sair como "[object Object]" numa imagem que o humano
 * só descobre errada depois de pagar por ela.
 */
function lerContexto(corpo: Record<string, unknown>): ContextoDeThumbnail {
  const personagens: PersonagemDoCanal[] = Array.isArray(corpo['personagens'])
    ? corpo['personagens'].flatMap((bruto) => {
        if (typeof bruto !== 'object' || bruto === null) return [];
        const registro = bruto as Record<string, unknown>;
        const name = typeof registro['name'] === 'string' ? registro['name'] : null;
        const role = typeof registro['role'] === 'string' ? registro['role'] : null;
        if (name === null || role === null) return [];
        const version = typeof registro['sheetVersion'] === 'string' ? { sheetVersion: registro['sheetVersion'] } : {};
        return [{ name, role, ...version }];
      })
    : [];

  const paleta = Array.isArray(corpo['paleta'])
    ? corpo['paleta'].filter((cor): cor is string => typeof cor === 'string')
    : [];

  const contexto: ContextoDeThumbnail = { personagens, paleta };
  const tema = typeof corpo['tema'] === 'string' ? corpo['tema'].trim() : '';
  const titulo = typeof corpo['titulo'] === 'string' ? corpo['titulo'].trim() : '';

  return {
    ...contexto,
    ...(tema.length > 0 ? { tema } : {}),
    ...(titulo.length > 0 ? { titulo } : {}),
  };
}

/**
 * Roteia um pedido de mídia.
 *
 * `searchParams` é o `URLSearchParams` da requisição. O `pathname` chega completo (`/api/media/episodes`)
 * porque o plugin do Vite e a função serverless veem o caminho de formas diferentes — normalizar aqui,
 * em um lugar só, evita a divergência.
 *
 * Desde o `ADR-014`, **toda** rota desta API passa pela guarda de identidade, e ela vem antes de
 * qualquer leitura, de qualquer geração **e da leitura do corpo**. Isso inclui `GET /api/media/file`,
 * que serve a arte: um `<img src>` não consegue mandar o header `Authorization`, então o navegador
 * busca o arquivo por `fetch` e o exibe de um `blob:` — foi a consequência encontrada ao aplicar a
 * guarda, e está registrada no ADR.
 *
 * `lerCorpo` é uma **função**, e não o corpo já lido, pelo defeito que o `rebeca-qa` reproduziu
 * (`QA-014`): com a leitura feita antes da guarda, uma requisição sem credencial nenhuma recebia
 * `400 corpo-invalido` em vez de `401` — e o processo ainda analisava o corpo de quem não se
 * identificou.
 */
export async function routeMediaRequest(
  method: string,
  pathname: string,
  searchParams: URLSearchParams,
  lerCorpo?: () => Promise<unknown>,
  options: AuthContext = {},
): Promise<MediaHttpResult> {
  const verb = method.toUpperCase();

  const auth = await authorizeRequest({
    ...options,
    costly: pathname === '/api/media/thumbnails',
  });
  if (!auth.ok) return { status: auth.status, body: auth.body };

  /*
   * `POST /api/media/thumbnails` — a rota que faz a ARTE existir.
   *
   * É a única rota que pode gastar dinheiro, e por isso roda os portões na ordem do `ADR-010`:
   * allow-list do canal → idempotência (o que já existe não é gerado de novo) → teto mensal → gerar.
   * Ela nunca escolhe o provedor por conta própria: `providerForThumbnails()` devolve MiniMax quando há
   * chave e o simulado local quando não há, e **diz qual usou** no campo `simulated` da resposta.
   */
  if (pathname === '/api/media/thumbnails') {
    if (verb !== 'POST') {
      return fail(405, 'metodo-nao-permitido', `A geração de thumbnails é POST; recebi ${verb}.`);
    }

    /*
     * O corpo só é lido **depois** da guarda. Corpo ruim continua sendo 400 `corpo-invalido` (e não o
     * 500 de "falha ao gerar"): é erro de quem chamou, e a mensagem diz isso.
     */
    let lido: unknown;
    try {
      lido = lerCorpo === undefined ? undefined : await lerCorpo();
    } catch (error) {
      const detalhe = error instanceof Error ? error.message : String(error);
      return fail(400, 'corpo-invalido', `O corpo da requisição não é JSON válido: ${detalhe}`);
    }

    const corpo = (typeof lido === 'object' && lido !== null ? lido : {}) as Record<string, unknown>;
    const canal = token(typeof corpo['channelId'] === 'string' ? corpo['channelId'] : null);
    const episodio = token(typeof corpo['episodeId'] === 'string' ? corpo['episodeId'] : null);

    if (canal === null) {
      return fail(
        400,
        'canal-obrigatorio',
        'Informe o canal (channelId) no corpo. Toda geração de mídia é escopada por canal.',
      );
    }
    if (episodio === null) {
      return fail(400, 'episodio-obrigatorio', 'Informe o episódio (episodeId) — é ele que dá nome à pasta da mídia.');
    }

    try {
      const escolha = providerForThumbnails();
      /*
       * O contexto vem do corpo porque **quem tem o dado é a tela**: personagens oficiais do canal, tema,
       * título e paleta vivem na camada de dados do app, e o servidor não deve importar dado de exemplo
       * para dentro do bundle do servidor. O que o servidor faz é **compor o prompt** a partir do que foi
       * declarado — antes esses prompts eram fixos no código e descreviam um personagem que não era o do
       * canal, alegando ainda que a ficha não existia.
       */
      const result = await generateThumbnails({
        channelId: canal,
        episodeId: episodio,
        promptVersion: 'criar-thumbnail@v1',
        options: opcoesPara(lerContexto(corpo)),
        provider: escolha.provider,
        identidadeSub: auth.identity.sub,
      });
      return { status: 200, body: { ...result, motivoDoProvedor: escolha.motivo } };
    } catch (error) {
      if (error instanceof ProviderNotAllowedError) {
        return fail(403, error.code, error.message);
      }
      if (error instanceof MediaBudgetError) {
        return fail(402, error.code, error.message);
      }
      if (error instanceof ChannelScopeError) {
        return fail(400, error.code, error.message);
      }
      const message = error instanceof Error ? error.message : String(error);
      return fail(500, 'geracao-de-thumbnail', `Falha ao gerar as opções de thumbnail: ${message.slice(0, 300)}`);
    }
  }

  if (verb !== 'GET') {
    return fail(405, 'metodo-nao-permitido', `A leitura de mídia é somente GET; recebi ${verb}.`);
  }

  const channelId = token(searchParams.get('channelId'));

  if (channelId === null) {
    return fail(
      400,
      'canal-obrigatorio',
      'Informe o canal (channelId). Toda leitura de mídia é escopada por canal — não existe consulta sem canal.',
    );
  }

  try {
    /*
     * `GET /api/media/custos` — **quanto este conteúdo custou de verdade**.
     *
     * A tela de Revisão mostrava, com o rótulo "Custo real", o `costUsd` do arquivo de **exemplo**:
     * US$ 42,80 para um conteúdo cujo livro soma US$ 0,3956. Esta rota existe para que o número venha
     * do livro — a única fonte que registra gasto efetivo (invariante nº 4).
     *
     * O livro guarda o **nome** do canal, não o id; o nome sai do spec de mídia do canal. Sem spec, a
     * resposta é `ledgerAvailable: false` com motivo, e a tela diz "não sei" — que é diferente de
     * "gastei zero", e a diferença é o ponto.
     */
    if (pathname === '/api/media/custos') {
      const contentId = token(searchParams.get('contentId'));
      if (contentId === null) {
        return fail(400, 'conteudo-obrigatorio', 'Informe o conteúdo (contentId) para ler o custo dele.');
      }

      const nome = loadChannelMediaSpec(channelId)?.nome;
      if (nome === undefined || nome.trim() === '') {
        return {
          status: 200,
          body: {
            contentId,
            channelName: null,
            ledgerAvailable: false,
            totalUsd: 0,
            rows: 0,
            byStage: [],
            motivo:
              `O canal "${channelId}" não tem spec de mídia (.rebeca/canais/${channelId}/spec-midia.json), ` +
              'e o livro de custos identifica o canal pelo nome de exibição. Sem o nome não dá para somar ' +
              'sem risco de atribuir gasto ao canal errado — por isso a resposta é "não sei", não zero.',
          },
        };
      }

      return { status: 200, body: contentSpend(nome, contentId) };
    }

    if (pathname === '/api/media/episodes') {
      return { status: 200, body: readLibrary(channelId) };
    }

    if (pathname === '/api/media/episode') {
      const episodeId = token(searchParams.get('episodeId'));
      if (episodeId === null) {
        return fail(400, 'episodio-obrigatorio', 'Informe o episódio (episodeId) para ler a mídia dele.');
      }

      const episode = readEpisodeView(channelId, episodeId);
      if (episode === null) {
        return fail(
          404,
          'episodio-sem-manifesto',
          `Não há episódio "${episodeId}" com manifesto (meta.json) no canal "${channelId}". ` +
            'Ou o pipeline ainda não rodou para este episódio, ou o identificador não é deste canal.',
        );
      }

      return { status: 200, body: episode };
    }

    /*
     * Serve o arquivo em si.
     *
     * **A defesa é a whitelist do manifesto**, não a sanitização do caminho: `asset` só é servido se já
     * constar no `meta.json` daquele episódio daquele canal. Um caminho inventado — `../../segredos`,
     * caminho absoluto, id de outro canal — não casa com nenhuma entrada e vira 404 antes de o disco ser
     * tocado. Sanitizar string de caminho é a defesa que falha no dia em que alguém esquece um caso;
     * perguntar ao manifesto é a defesa que não tem caso a esquecer.
     */
    if (pathname === '/api/media/file') {
      const episodeId = token(searchParams.get('episodeId'));
      const asset = token(searchParams.get('asset'));
      if (episodeId === null) {
        return fail(400, 'episodio-obrigatorio', 'Informe o episódio (episodeId) do arquivo.');
      }
      if (asset === null) {
        return fail(400, 'arquivo-obrigatorio', 'Informe o arquivo (asset) — o caminho relativo à raiz de ativos.');
      }

      const found = findManifestAsset(channelId, episodeId, asset);
      if (found === null) {
        return fail(
          404,
          'arquivo-fora-do-manifesto',
          `Nenhum ativo com o caminho "${asset}" está registrado no manifesto de "${episodeId}" no canal ` +
            `"${channelId}". Só arquivos que o pipeline registrou podem ser servidos.`,
        );
      }

      const contentType = CONTENT_TYPE[extname(found.absolutePath).toLowerCase()] ?? 'text/plain; charset=utf-8';
      return { status: 200, file: { absolutePath: found.absolutePath, contentType } };
    }
  } catch (error) {
    // `channelId`/`episodeId` malformado é pedido ruim (400), não falha do servidor (500). A distinção
    // importa: 500 faz o humano procurar defeito no lugar errado.
    if (error instanceof ChannelScopeError) {
      return fail(400, error.code, error.message);
    }
    const message = error instanceof Error ? error.message : String(error);
    return fail(500, 'leitura-de-midia', `Falha ao ler a mídia gerada: ${message.slice(0, 300)}`);
  }

  return fail(404, 'rota-desconhecida', `Rota de mídia desconhecida: ${pathname}.`);
}
