/**
 * Caminhos do pipeline de mídia — **o único lugar que decide onde um arquivo pode nascer**.
 *
 * Este arquivo existe por causa do invariante nº 2 do projeto: *todo dado, asset, métrica, prompt e
 * cache é escopado por canal; bug de vazamento entre canais é prioridade máxima*. Uma convenção de
 * pastas não é defesa suficiente, porque quem monta caminho com `join()` pode montar o caminho errado.
 * Aqui a regra é executável:
 *
 * - `episodeDir(escopo, dono, episodio)` **recusa** quando o canal dono do ativo é diferente do canal em
 *   que o pipeline está rodando. Não é aviso no log: é exceção, antes de o arquivo existir.
 * - `assertWithinChannel(escopo, caminho)` confere o caminho **já resolvido** contra a pasta daquele
 *   canal. É a segunda rede: pega `..`, caminho absoluto de fora e qualquer caminho montado por outro
 *   módulo sem passar por aqui.
 * - Todo segmento (`canal`, `episodio`, `slug`) passa por `assertSafeSegment`, que só aceita
 *   `[a-z0-9-]`. Isso elimina `..`, separador de caminho, dois-pontos de unidade do Windows e nome
 *   reservado — de uma vez, em vez de tratar caso a caso.
 *
 * Formato do caminho, idêntico ao da skill `rebeca-ia-video`:
 *
 *   `.rebeca/assets/<canal>/<episodio>/<etapa>/<slug>-<hash8>.<ext>`
 *   `.rebeca/assets/<canal>/<episodio>/render/v<N>/<slug>-16x9-v<N>.mp4`
 */

import { mkdirSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import type { MediaStage } from '../../src/media/contract.js';

export type ScopeErrorCode = 'canal-fora-de-escopo' | 'caminho-fora-do-canal' | 'segmento-invalido';

export class ChannelScopeError extends Error {
  readonly code: ScopeErrorCode;

  constructor(code: ScopeErrorCode, message: string) {
    super(message);
    this.name = 'ChannelScopeError';
    this.code = code;
  }
}

/** Raiz do repositório. `REBECA_ROOT` existe para os testes não escreverem no repositório real. */
export function repoRoot(): string {
  return process.env['REBECA_ROOT'] ? resolve(process.env['REBECA_ROOT']) : process.cwd();
}

/**
 * Raiz dos ativos.
 *
 * `REBECA_ASSETS_ROOT` é sobreposição de **teste** (o mesmo papel de `REBECA_COST_LEDGER` na camada de
 * IA): a suíte precisa gerar vídeo de verdade sem sujar a árvore de assets do projeto. Não é
 * configuração de produção — em produção vale `.rebeca/assets`.
 */
export function assetsRoot(): string {
  const configured = process.env['REBECA_ASSETS_ROOT'];
  if (configured) return resolve(configured);
  return join(repoRoot(), '.rebeca', 'assets');
}

const SAFE_SEGMENT = /^[a-z0-9][a-z0-9-]*$/;

/** Aceita só segmento de caminho simples. Recusar cedo é o que impede `..` de virar travessia. */
export function assertSafeSegment(value: string, what: string): string {
  if (typeof value !== 'string' || !SAFE_SEGMENT.test(value)) {
    throw new ChannelScopeError(
      'segmento-invalido',
      `O ${what} "${value}" não é um identificador válido. Use apenas letras minúsculas, números e hífen ` +
        '(sem barra, sem ponto, sem dois-pontos) — é o que impede um caminho de escapar da pasta do canal.',
    );
  }
  return value;
}

export function channelAssetsDir(channelId: string): string {
  return join(assetsRoot(), assertSafeSegment(channelId, 'canal'));
}

/**
 * Pasta do episódio — **o portão de isolamento**.
 *
 * Todo o resto do módulo deriva daqui, então não existe caminho de escrita que não passe por esta
 * checagem. `scopeChannelId` é o canal em que o pipeline roda; `channelId` é o dono do ativo.
 */
export function episodeDir(scopeChannelId: string, channelId: string, episodeId: string): string {
  const scope = assertSafeSegment(scopeChannelId, 'canal do escopo');
  const owner = assertSafeSegment(channelId, 'canal');
  const episode = assertSafeSegment(episodeId, 'episódio');

  if (owner !== scope) {
    throw new ChannelScopeError(
      'canal-fora-de-escopo',
      `Recusado: o pipeline está rodando no canal "${scope}" e tentou escrever ativo do canal "${owner}". ` +
        'Asset fora do escopo do canal é vazamento entre canais (invariante nº 2) — a escrita foi abortada antes de tocar o disco.',
    );
  }

  return join(channelAssetsDir(owner), episode);
}

export function manifestPath(scopeChannelId: string, channelId: string, episodeId: string): string {
  return join(episodeDir(scopeChannelId, channelId, episodeId), 'meta.json');
}

export interface AssetPathRequest {
  /** Canal em que o pipeline está rodando. */
  readonly scopeChannelId: string;
  /** Canal dono do ativo. Diferente do escopo ⇒ exceção. */
  readonly channelId: string;
  readonly episodeId: string;
  readonly stage: MediaStage;
  /** Identificador curto do ativo na etapa: `cena-01`, `trilha`… */
  readonly slug: string;
  readonly hash8: string;
  readonly ext: string;
}

const STAGE_DIR: Readonly<Record<MediaStage, string>> = {
  imagem: 'imagem',
  animacao: 'animacao',
  voz: 'voz',
  musica: 'musica',
  render: 'render',
  legenda: 'render',
  thumbnail: 'thumbnail',
};

const EXT = /^[a-z0-9]{2,5}$/;

/**
 * `.rebeca/assets/<canal>/<episodio>/<etapa>/<slug>-<hash8>.<ext>`
 *
 * O hash no nome é o que torna a escrita idempotente: mesma entrada ⇒ mesmo caminho ⇒ o arquivo já está
 * lá e não se paga de novo.
 */
export function assetPath(request: AssetPathRequest): string {
  const dir = join(episodeDir(request.scopeChannelId, request.channelId, request.episodeId), STAGE_DIR[request.stage]);
  const slug = assertSafeSegment(request.slug, 'slug do ativo');
  const hash8 = assertSafeSegment(request.hash8, 'hash');
  if (!EXT.test(request.ext)) {
    throw new ChannelScopeError('segmento-invalido', `Extensão de arquivo inválida: "${request.ext}".`);
  }
  return assertWithinChannel(request.scopeChannelId, join(dir, `${slug}-${hash8}.${request.ext}`));
}

/** Pasta de uma versão de render. `v<N>` na pasta é o que impede sobrescrever material já aprovado. */
export function renderDir(scopeChannelId: string, channelId: string, episodeId: string, version: number): string {
  if (!Number.isInteger(version) || version < 1) {
    throw new ChannelScopeError('segmento-invalido', `Versão de render inválida: ${String(version)}.`);
  }
  return assertWithinChannel(
    scopeChannelId,
    join(episodeDir(scopeChannelId, channelId, episodeId), 'render', `v${version}`),
  );
}

/** Caminho de um arquivo dentro da pasta de render (longo, Short ou legenda). */
export function renderPath(
  scopeChannelId: string,
  channelId: string,
  episodeId: string,
  version: number,
  fileName: string,
): string {
  // Nome vem de `renderFileName` (montado por nós). O `basename` aqui é a rede contra alguém passar
  // caminho relativo disfarçado de nome de arquivo.
  const safe = assertSafeSegment(fileName.replace(/\.[a-z0-9]+$/, ''), 'nome do arquivo de render');
  const ext = fileName.slice(safe.length + 1);
  // Extensão conferida com a MESMA regra de `assetPath`: sem isso, um nome sem extensão devolvia
  // caminho terminando em ponto (`.../v1/sem-extensao.`) — arquivo que o ffmpeg escreve e o humano não
  // acha. Achado de gravidade baixa do `rebeca-qa`.
  if (!EXT.test(ext)) {
    throw new ChannelScopeError(
      'segmento-invalido',
      `Nome de arquivo de render sem extensão válida: "${fileName}".`,
    );
  }
  return join(renderDir(scopeChannelId, channelId, episodeId, version), `${safe}.${ext}`);
}

/**
 * Pasta de trabalho do episódio: derivados **reconstruíveis** (voz alinhada, listas do concat).
 *
 * Fica dentro da pasta do canal de propósito — tudo que um episódio produz tem de estar sob o escopo
 * dele. Não entra no manifesto porque não tem identidade própria: é função pura da voz medida e da
 * timeline, e qualquer execução a reconstrói com o mesmo nome.
 */
export function workDir(scopeChannelId: string, channelId: string, episodeId: string): string {
  return join(episodeDir(scopeChannelId, channelId, episodeId), '_montagem');
}

export function workPath(
  scopeChannelId: string,
  channelId: string,
  episodeId: string,
  fileName: string,
): string {
  const safe = assertSafeSegment(fileName.replace(/\.[a-z0-9]+$/, ''), 'nome do arquivo de montagem');
  const ext = fileName.slice(safe.length + 1);
  return join(workDir(scopeChannelId, channelId, episodeId), `${safe}.${ext}`);
}

/**
 * Segunda rede do isolamento: o caminho resolvido está dentro da pasta deste canal?
 *
 * Pega o que a checagem de segmento não pega — caminho absoluto vindo de fora, `..` montado por outro
 * módulo, junção com `join()` de valor não validado.
 */
export function assertWithinChannel(scopeChannelId: string, filePath: string): string {
  const root = resolve(channelAssetsDir(scopeChannelId));
  const target = resolve(filePath);
  if (target !== root && !target.startsWith(root + sep)) {
    throw new ChannelScopeError(
      'caminho-fora-do-canal',
      `Recusado: "${target}" está fora da pasta do canal "${scopeChannelId}" (${root}). ` +
        'Todo arquivo do pipeline tem de nascer dentro de .rebeca/assets/<canal>/<episodio>/ (invariante nº 2).',
    );
  }
  return target;
}

/** Cria a pasta do arquivo. Sempre depois da checagem de escopo, nunca antes. */
export function ensureParentDir(filePath: string): void {
  mkdirSync(dirname(filePath), { recursive: true });
}

/**
 * Caminho relativo à raiz de ativos.
 *
 * É esta forma que entra no **hash** e no manifesto: `/home/ana/...` e `E:\...` produziriam hashes
 * diferentes para o mesmo conteúdo.
 */
export function assetsRelativePath(absolutePath: string): string {
  const rel = relative(assetsRoot(), resolve(absolutePath));
  if (rel.startsWith('..') || isAbsolute(rel)) {
    throw new ChannelScopeError(
      'caminho-fora-do-canal',
      `"${absolutePath}" não está sob a raiz de ativos (${assetsRoot()}).`,
    );
  }
  return rel.replaceAll('\\', '/');
}

/** Caminho relativo à raiz do repositório, para o manifesto e para o relatório. */
export function repoRelativePath(absolutePath: string): string {
  const rel = relative(repoRoot(), resolve(absolutePath));
  return (rel.startsWith('..') ? resolve(absolutePath) : rel).replaceAll('\\', '/');
}
