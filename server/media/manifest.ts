/**
 * Manifesto do episódio — `.rebeca/assets/<canal>/<episodio>/meta.json`.
 *
 * O manifesto é a memória do pipeline. Sem ele, "idempotência" seria só uma intenção: não haveria como
 * saber que o ativo daquela cena, com aquele hash, já foi gerado e pago.
 *
 * Quatro regras que este arquivo garante:
 *
 * 1. **Reuso por hash.** `findReusable` só devolve um ativo quando o hash bate **e** o arquivo existe
 *    no disco. Manifesto apontando para arquivo que sumiu é pior que manifesto vazio: faria o pipeline
 *    pular a geração e entregar um caminho quebrado.
 * 2. **Versão nova em vez de sobrescrita.** Conteúdo diferente ⇒ `v2`, `v3`. Artefato aprovado pelo
 *    humano nunca é substituído no mesmo nome — a aprovação passaria a valer para um vídeo que ninguém
 *    viu.
 * 3. **O teto em vigor fica gravado junto do gasto.** `limits` guarda os números aprovados no momento
 *    da execução; um `meta.json` sozinho não responde "esse gasto estava dentro do teto?" se o teto
 *    mudar depois.
 * 4. **Referência visual declarada.** Na Fase 0 é `sintetica` porque o Character Sheet da Luna **não
 *    existe no repositório**. Está escrito no arquivo, não presumido.
 */

import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import type { AssetReference, MediaAsset, MediaStage } from '../../src/media/contract.js';
import { limitsSnapshot, type MediaLimitsSnapshot } from '../../src/media/limits.js';
import { assetsRoot, ensureParentDir, manifestPath, repoRelativePath } from './paths.js';

/** Situação da referência visual do canal. `ausente` é o estado real hoje para a Luna. */
export interface ManifestReference {
  readonly characterSheet: 'ausente' | 'presente';
  readonly tipo: AssetReference;
  readonly nota: string;
}

export interface EpisodeManifest {
  readonly channelId: string;
  readonly episodeId: string;
  readonly slug: string;
  readonly updatedAt: string;
  /** Tetos aprovados (D2/D5) no momento da execução — o gasto tem de ser auditável com o teto. */
  readonly limits: MediaLimitsSnapshot;
  readonly referenciaVisual: ManifestReference;
  readonly assets: readonly MediaAsset[];
}

/**
 * A verdade de hoje, escrita com todas as letras.
 *
 * Não há arte de personagem no repositório inteiro: `.rebeca/canais/` nem existia antes desta tarefa e
 * não há imagem da Luna. Inventar um "character sheet" aqui faria a Fase 0 parecer o que ela não é.
 */
export const REFERENCIA_SINTETICA: ManifestReference = {
  characterSheet: 'ausente',
  tipo: 'sintetica',
  nota:
    'Character Sheet da Luna NÃO existe no repositório (dívida do rebeca-branding). A Fase 0 usa referência ' +
    'sintética: os ativos desta execução estão marcados simulated=true e reference=sintetica. Nada aqui prova ' +
    'consistência de personagem (invariante nº 3) — isso só começa na Fase 1, com a arte oficial.',
};

/** Caminho do arquivo a partir do que está gravado no manifesto (resiliente a mudança de raiz). */
export function resolveStoredPath(asset: Pick<MediaAsset, 'path' | 'pathFromAssets'>): string {
  if (asset.pathFromAssets && asset.pathFromAssets.length > 0) {
    return join(assetsRoot(), asset.pathFromAssets);
  }
  return isAbsolute(asset.path) ? asset.path : resolve(asset.path);
}

export function readManifest(scopeChannelId: string, channelId: string, episodeId: string): EpisodeManifest | null {
  const path = manifestPath(scopeChannelId, channelId, episodeId);
  if (!existsSync(path)) return null;
  const raw = JSON.parse(readFileSync(path, 'utf8')) as Partial<EpisodeManifest>;
  return {
    channelId: raw.channelId ?? channelId,
    episodeId: raw.episodeId ?? episodeId,
    slug: raw.slug ?? episodeId,
    updatedAt: raw.updatedAt ?? new Date(0).toISOString(),
    limits: raw.limits ?? limitsSnapshot(),
    referenciaVisual: raw.referenciaVisual ?? REFERENCIA_SINTETICA,
    assets: Array.isArray(raw.assets) ? raw.assets : [],
  };
}

/**
 * Grava o manifesto de forma atômica.
 *
 * Gravação direta no lugar deixaria um JSON truncado se o processo morresse no meio — e um manifesto
 * ilegível faz o pipeline regenerar (e repagar) tudo. Escreve ao lado e renomeia.
 */
export function writeManifest(manifest: EpisodeManifest, scopeChannelId: string): string {
  const path = manifestPath(scopeChannelId, manifest.channelId, manifest.episodeId);
  ensureParentDir(path);
  const temp = `${path}.tmp`;
  writeFileSync(temp, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  renameSync(temp, path);
  return path;
}

export function emptyManifest(channelId: string, episodeId: string, slug: string, now: Date): EpisodeManifest {
  return {
    channelId,
    episodeId,
    slug,
    updatedAt: now.toISOString(),
    limits: limitsSnapshot(),
    referenciaVisual: REFERENCIA_SINTETICA,
    assets: [],
  };
}

/**
 * Já existe ativo com este hash **e** o arquivo está no disco?
 *
 * As duas condições juntas. Só o hash no manifesto não basta: se o arquivo foi apagado, reusar seria
 * entregar caminho quebrado; só o arquivo no disco também não basta, porque o manifesto é que diz de
 * qual provedor/prompt ele veio.
 */
export function findReusable(
  manifest: EpisodeManifest | null,
  stage: MediaStage,
  key: string,
  hash: string,
): MediaAsset | undefined {
  if (manifest === null) return undefined;
  return manifest.assets.find(
    (asset) => asset.stage === stage && asset.key === key && asset.hash === hash && existsSync(resolveStoredPath(asset)),
  );
}

/** Última versão gravada de um ativo, aprovada ou não. */
export function latestVersion(manifest: EpisodeManifest | null, stage: MediaStage, key: string): number {
  if (manifest === null) return 0;
  const versions = manifest.assets.filter((asset) => asset.stage === stage && asset.key === key).map((asset) => asset.version);
  return versions.length === 0 ? 0 : Math.max(...versions);
}

/**
 * Qual versão usar nesta execução.
 *
 * - nunca gerado ⇒ `1`;
 * - mesmo hash já existe ⇒ a **mesma** versão (é o mesmo conteúdo: reusar é o certo, e é o que faz a
 *   segunda execução não criar arquivo novo);
 * - conteúdo diferente ⇒ `máxima + 1`.
 *
 * Não existe caminho em que conteúdo novo caia em cima de versão antiga.
 */
export function nextVersion(manifest: EpisodeManifest | null, stage: MediaStage, key: string, hash: string): number {
  if (manifest === null) return 1;
  const same = manifest.assets.filter((asset) => asset.stage === stage && asset.key === key);
  if (same.length === 0) return 1;
  const identical = same.find((asset) => asset.hash === hash);
  if (identical) return identical.version;
  return Math.max(...same.map((asset) => asset.version)) + 1;
}

/** Insere/substitui entradas. Substitui só a **mesma** versão; versões antigas permanecem. */
export function upsertAssets(manifest: EpisodeManifest, entries: readonly MediaAsset[], now: Date): EpisodeManifest {
  const kept = manifest.assets.filter(
    (asset) => !entries.some((entry) => entry.stage === asset.stage && entry.key === asset.key && entry.version === asset.version),
  );
  return {
    ...manifest,
    updatedAt: now.toISOString(),
    assets: [...kept, ...entries].sort((a, b) =>
      a.stage === b.stage ? (a.key === b.key ? a.version - b.version : a.key.localeCompare(b.key)) : a.stage.localeCompare(b.stage),
    ),
  };
}

/**
 * Marca um ativo como aprovado pelo humano.
 *
 * Existe para o fluxo de revisão (`3.4 Revisar`) ter onde gravar a decisão: a partir daí aquela versão
 * não é sobrescrita, e a próxima geração do mesmo ativo nasce como `v+1`.
 */
export function approveAsset(
  manifest: EpisodeManifest,
  stage: MediaStage,
  key: string,
  version: number,
  now: Date,
): EpisodeManifest {
  const found = manifest.assets.some((asset) => asset.stage === stage && asset.key === key && asset.version === version);
  if (!found) {
    throw new Error(`Não há ${stage}/${key} v${version} no manifesto para aprovar.`);
  }
  return {
    ...manifest,
    updatedAt: now.toISOString(),
    assets: manifest.assets.map((asset) =>
      asset.stage === stage && asset.key === key && asset.version === version ? { ...asset, approved: true } : asset,
    ),
  };
}

/** Caminho relativo ao repositório, para relatório e para o manifesto. */
export function describePath(absolutePath: string): string {
  return repoRelativePath(absolutePath);
}
