/**
 * Leitura do que o pipeline gerou — a camada que faltava entre o disco e a tela.
 *
 * **O defeito que este arquivo fecha.** A Fase 0 do pipeline (`ADR-010`) entregou 13 ativos reais em
 * `.rebeca/assets/luna/luna-ep-001/` e gravou tudo no `meta.json`. Nenhuma tela sabia disso: a camada de
 * dados do app (`src/data/client.ts`) importa `./mock/db` e nunca faz `fetch`. Resultado relatado pelo
 * dono do produto, com razão: *"ele gerou mas não apareceu"*.
 *
 * Duas decisões que valem explicação:
 *
 * 1. **Nada aqui inventa vínculo.** O episódio da Fase 0 chama-se `luna-ep-001` e o próprio spec o
 *    descreve como *"Episódio sintético da Fase 0 (não é conteúdo do canal)"*. Não existe ligação entre
 *    ele e nenhum conteúdo da biblioteca. Ligar os dois por semelhança de nome (ou por "deve ser o do
 *    arco-íris") produziria uma tela que afirma uma linhagem que ninguém declarou. Por isso a leitura é
 *    **por canal**, e o vínculo conteúdo↔episódio fica para quando existir de verdade.
 * 2. **`existsOnDisk` é medido a cada leitura.** Manifesto apontando para arquivo que sumiu é pior que
 *    manifesto vazio: a tela diria "gerado" sobre um arquivo que não existe. Medir é barato; afirmar
 *    errado custa a confiança no painel inteiro.
 *
 * Isolamento (invariante nº 2): o escopo é sempre `channelId` — `scopeChannelId === channelId`, porque a
 * tela apresenta um canal por vez. Um `channelId` com `..`, barra ou dois-pontos é **recusado** antes de
 * tocar o disco (`ChannelScopeError`), e um manifesto cujo `channelId` interno divirja do canal pedido é
 * tratado como inexistente — as duas redes, não uma.
 */

import { existsSync, readdirSync, statSync } from 'node:fs';
import type { MediaAsset } from '../../src/media/contract.js';
import type {
  MediaAssetView,
  MediaEpisodeSummary,
  MediaEpisodeView,
  MediaLibraryView,
} from '../../src/media/view.js';
import { ChannelScopeError, channelAssetsDir } from './paths.js';
import { readManifest, resolveStoredPath, type EpisodeManifest } from './manifest.js';

/**
 * Por que um canal pode não ter mídia para mostrar.
 *
 * Escrito uma vez, aqui, para as duas telas dizerem a mesma coisa. Não é mensagem de erro: é o estado
 * normal de um deploy — `.rebeca/assets/` está no `.gitignore` (linha 45) porque asset pesado não vai
 * para o git, e o Storage escopado por canal é trabalho da F1.
 */
export const MOTIVO_SEM_MIDIA =
  'Este ambiente não tem mídia gerada para este canal. O pipeline da Fase 0 grava os arquivos em ' +
  '.rebeca/assets/<canal>/<episódio>/, e essa pasta está no .gitignore — os ativos existem só na máquina ' +
  'onde o pipeline rodou. Rodar `node .tools/render-episodio.mjs` gera o episódio sintético localmente; ' +
  'levar os ativos para o ambiente publicado é o Storage escopado por canal, que ainda não existe (F1).';

/** Duração somada: imagem não tem duração e entra como 0 — somar o que não existe seria invenção. */
function sumDuration(views: readonly MediaAssetView[]): number {
  return views.reduce((total, view) => total + (Number.isFinite(view.durationMs) ? view.durationMs : 0), 0);
}

function sumBytes(views: readonly MediaAssetView[]): number {
  return views.reduce((total, view) => total + (Number.isFinite(view.bytes) ? view.bytes : 0), 0);
}

function sumCost(views: readonly MediaAssetView[]): number {
  return views.reduce((total, view) => total + (Number.isFinite(view.costUsd) ? view.costUsd : 0), 0);
}

function renderVersionOf(views: readonly MediaAssetView[]): number | null {
  const versions = views.filter((view) => view.stage === 'render').map((view) => view.version);
  return versions.length === 0 ? null : Math.max(...versions);
}

/**
 * Resumo derivado **das mesmas views** que a tela lista — nunca de uma segunda varredura do manifesto.
 *
 * Isso não é economia: é a garantia de que o número do cartão e a tabela de ativos não podem divergir.
 * Duas contagens do mesmo manifesto é como dois relatórios do mesmo mês passam a discordar.
 *
 * **Duas semânticas de total, de propósito** — e a distinção importa:
 *
 * - `totalBytes` e `totalDurationMs` descrevem **o que está no disco agora**: contam só os arquivos
 *   presentes. Somar a duração de um render apagado faria o cartão dizer "27 s de vídeo" quando não há
 *   vídeo nenhum para abrir — a mesma família de mentira que esta tela existe para corrigir.
 * - `totalCostUsd` e `simulatedCount` descrevem **o que aconteceu**: contam tudo o que foi gerado,
 *   exista o arquivo ou não. Apagar um arquivo não devolve o dinheiro gasto nem muda quem o gerou; um
 *   custo que some quando o arquivo some seria um livro de custos que mente.
 */
function summarize(input: {
  readonly episodeId: string;
  readonly slug: string;
  readonly updatedAt: string;
  readonly characterSheet: 'ausente' | 'presente';
  readonly views: readonly MediaAssetView[];
}): MediaEpisodeSummary {
  const presentes = input.views.filter((view) => view.existsOnDisk);

  return {
    episodeId: input.episodeId,
    slug: input.slug,
    updatedAt: input.updatedAt,
    assetCount: input.views.length,
    missingCount: input.views.length - presentes.length,
    totalBytes: sumBytes(presentes),
    totalDurationMs: sumDuration(presentes),
    totalCostUsd: sumCost(input.views),
    simulatedCount: input.views.filter((view) => view.simulated).length,
    renderVersion: renderVersionOf(input.views),
    characterSheet: input.characterSheet,
  };
}

/**
 * O manifesto é deste canal?
 *
 * O caminho já garante que a pasta é do canal (o arquivo está em `.rebeca/assets/<canal>/<episódio>/`).
 * Esta checagem cobre o caso do manifesto **mentiroso** — copiado de outro canal, ou gravado por uma
 * execução com escopo errado. Divergiu ⇒ tratado como inexistente, e a tela não mostra ativo de outro
 * canal (invariante nº 2).
 */
function belongsToChannel(manifest: EpisodeManifest, channelId: string): boolean {
  return manifest.channelId === channelId;
}

/**
 * Mede o arquivo uma vez e devolve as duas informações que a tela precisa: existe? quantos bytes tem?
 *
 * Uma syscall só, e — mais importante — **uma fonte só**. Antes o tamanho exibido na lista vinha do
 * manifesto e o total era medido no disco: dois números para a mesma coisa, que podem discordar sem que
 * ninguém perceba. O rótulo da tela diz "tamanho no disco", então é o disco que responde.
 */
function measureAsset(asset: Pick<MediaAsset, 'path' | 'pathFromAssets'>): { exists: boolean; bytes: number } {
  try {
    const stat = statSync(resolveStoredPath(asset));
    return { exists: stat.isFile(), bytes: stat.size };
  } catch {
    // Caminho que escapa da raiz de ativos ou arquivo que sumiu: não existe para a tela. Não é erro que
    // derruba a listagem — é exatamente o caso que `existsOnDisk` existe para mostrar.
    return { exists: false, bytes: 0 };
  }
}

/** Ativos do manifesto convertidos na forma que a tela consome, com o disco medido. */
function toAssetViews(assets: readonly MediaAsset[]): MediaAssetView[] {
  return assets.map((asset) => {
    const disco = measureAsset(asset);
    return {
      stage: asset.stage,
      key: asset.key,
      version: asset.version,
      kind: asset.kind,
      pathFromAssets: asset.pathFromAssets,
      hash: asset.hash,
      durationMs: asset.durationMs,
      bytes: disco.bytes,
      providerId: asset.providerId,
      model: asset.model,
      promptVersion: asset.promptVersion,
      costUsd: asset.costUsd,
      simulated: asset.simulated,
      reference: asset.reference,
      approved: asset.approved,
      recordedAt: asset.recordedAt,
      existsOnDisk: disco.exists,
    };
  });
}

/**
 * Um episódio por inteiro, ou `null` se ele não existe **neste** canal.
 *
 * `null` cobre os três casos sem distingui-los na resposta — e é de propósito: dizer "existe, mas é de
 * outro canal" para quem perguntou por um `episodeId` que não é daquele canal já é informação sobre
 * outro canal. Quem não tem o dado não recebe nem a existência dele.
 */
export function readEpisodeView(channelId: string, episodeId: string): MediaEpisodeView | null {
  const manifest = readManifest(channelId, channelId, episodeId);
  if (manifest === null) return null;
  if (!belongsToChannel(manifest, channelId)) return null;

  const assets = toAssetViews(manifest.assets);

  return {
    channelId,
    ...summarize({
      episodeId: manifest.episodeId,
      slug: manifest.slug,
      updatedAt: manifest.updatedAt,
      characterSheet: manifest.referenciaVisual.characterSheet,
      views: assets,
    }),
    limits: manifest.limits,
    referenciaVisual: manifest.referenciaVisual,
    assets,
  };
}

/**
 * Os episódios com manifesto presente na pasta do canal.
 *
 * Pasta sem `meta.json` é ignorada: sem manifesto não há procedência, provedor nem hash — listar um
 * diretório solto como "episódio gerado" seria apresentar arquivo órfão como se fosse material do canal.
 */
export function listChannelEpisodes(channelId: string): MediaEpisodeSummary[] {
  // `channelAssetsDir` valida o segmento: `..`, barra e dois-pontos viram exceção aqui, antes do disco.
  const dir = channelAssetsDir(channelId);
  if (!existsSync(dir)) return [];

  const episodes: MediaEpisodeSummary[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const manifest = readManifest(channelId, channelId, entry.name);
    if (manifest === null) continue;
    if (!belongsToChannel(manifest, channelId)) continue;

    episodes.push(
      summarize({
        episodeId: manifest.episodeId,
        slug: manifest.slug,
        updatedAt: manifest.updatedAt,
        characterSheet: manifest.referenciaVisual.characterSheet,
        views: toAssetViews(manifest.assets),
      }),
    );
  }

  // Mais recente primeiro: é a ordem em que o humano procura ("o que eu acabei de gerar").
  return episodes.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/**
 * Localiza um arquivo **do manifesto** para servir ao navegador.
 *
 * Por que a busca é no manifesto, e não no caminho pedido: aceitar caminho vindo da query string é
 * travessia de diretório esperando para acontecer, por mais que se normalize. Aqui o chamador manda um
 * `pathFromAssets`, e ele só é servido se **já constar no manifesto daquele episódio daquele canal** —
 * ou seja, o conjunto de arquivos servíveis é exatamente o conjunto que o pipeline registrou. Um caminho
 * inventado não casa com nada e vira 404, sem nunca chegar ao disco.
 */
export function findManifestAsset(
  channelId: string,
  episodeId: string,
  pathFromAssets: string,
): { readonly absolutePath: string; readonly asset: MediaAsset } | null {
  const manifest = readManifest(channelId, channelId, episodeId);
  if (manifest === null) return null;
  if (!belongsToChannel(manifest, channelId)) return null;

  const asset = manifest.assets.find((item) => item.pathFromAssets === pathFromAssets);
  if (asset === undefined) return null;
  if (!measureAsset(asset).exists) return null;

  return { absolutePath: resolveStoredPath(asset), asset };
}

/**
 * O que existe de mídia para o canal — incluindo o caso em que não existe nada.
 *
 * Devolve `available: false` com motivo em vez de lista vazia muda. E devolve isso **antes** de tentar
 * listar quando a pasta do canal não existe, porque aí não há o que listar e o motivo é o mesmo para
 * todos os episódios.
 *
 * `ChannelScopeError` **não** é engolido: `channelId` inválido é pedido malformado (400 na rota), não
 * "canal sem mídia" — tratar os dois como iguais esconderia um erro de chamada atrás de uma mensagem de
 * estado vazio.
 */
export function readLibrary(channelId: string): MediaLibraryView {
  const dir = channelAssetsDir(channelId); // valida o segmento (pode lançar ChannelScopeError)

  if (!existsSync(dir)) {
    return { channelId, available: false, reason: MOTIVO_SEM_MIDIA, episodes: [] };
  }

  const episodes = listChannelEpisodes(channelId);
  if (episodes.length === 0) {
    return {
      channelId,
      available: false,
      reason:
        `A pasta do canal existe em .rebeca/assets/${channelId}/, mas nenhum episódio tem manifesto ` +
        '(meta.json). Sem manifesto não há procedência, provedor nem hash — arquivo solto não é ' +
        'apresentado como episódio gerado.',
      episodes: [],
    };
  }

  return { channelId, available: true, reason: null, episodes };
}

export { ChannelScopeError };
export type { MediaEpisodeView, MediaEpisodeSummary, MediaLibraryView, MediaAssetView };
