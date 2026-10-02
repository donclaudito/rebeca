/**
 * A leitura que fez o que o pipeline gerou **aparecer** — com as três coisas que podem dar errado nela.
 *
 * Contexto do defeito: o dono do produto rodou o pipeline da Fase 0, 13 arquivos reais nasceram em
 * `.rebeca/assets/luna/luna-ep-001/`, e a interface continuou dizendo "nenhum vídeo foi gerado ainda".
 * Nada no app lia o manifesto. Estes testes cobrem a ponte criada para fechar isso, e atacam os três
 * modos de falha que importam:
 *
 * 1. **Afirmar o que não existe.** O manifesto pode apontar para arquivo que já foi apagado. A tela
 *    dizer "gerado" nesse caso é a mesma mentira de antes, com outra roupa. `existsOnDisk` é medido.
 * 2. **Vazar entre canais.** Esta leitura devolve **caminho de arquivo**, que é o dado mais concreto que
 *    o produto tem. Um episódio de outro canal que apareça aqui é o invariante nº 2 furado.
 * 3. **Ausência confundida com defeito.** Em ambiente publicado não há mídia (`.rebeca/assets/` está no
 *    `.gitignore`). Lista vazia sem motivo é indistinguível de "quebrou" — e foi assim que o dono leu a
 *    tela antes.
 *
 * Tudo em diretório temporário (`REBECA_ASSETS_ROOT`): o teste não pode depender nem sujar a árvore real
 * de ativos, que é local e não versionada.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { MediaAsset } from '../contract.js';
import { assetsRoot, ChannelScopeError } from '../../../server/media/paths.js';
import { emptyManifest, readManifest, upsertAssets, writeManifest } from '../../../server/media/manifest.js';
import {
  listChannelEpisodes,
  MOTIVO_SEM_MIDIA,
  readEpisodeView,
  readLibrary,
} from '../../../server/media/library.js';
import { routeMediaRequest as rotaDeMidiaSemIdentidade } from '../../../server/media/http.js';
import {
  autenticacaoDeTeste,
  CLIENT_ID_DE_TESTE,
  isolarAmbiente,
  SUB_AUTORIZADO,
} from '../../auth/__tests__/test-support.js';

/**
 * Rota de mídia **com identidade**.
 *
 * Este arquivo mede leitura de manifesto, escopo de canal e disco medido — não a fronteira de acesso,
 * que tem arquivo próprio (`src/auth/__tests__/rotas.test.ts`) com o 401 sem credencial, o 403 de
 * conta fora da lista e a prova de que, recusada, a geração **não é cobrada**. Aqui a identidade é
 * dada de entrada, como no app real depois do login.
 */
const routeMediaRequest = (
  method: string,
  pathname: string,
  searchParams: URLSearchParams,
  body?: unknown,
) => rotaDeMidiaSemIdentidade(method, pathname, searchParams, async () => body, autenticacaoDeTeste());

const AGORA = new Date('2026-10-01T09:13:03.532Z');

let tempDir = '';
let restaurarAmbiente: () => void = () => {};

beforeEach(() => {
  // A guarda falha fechada: sem `GOOGLE_CLIENT_ID` ela responde 503 e sem `REBECA_ALLOWED_SUBS`
  // ninguém entra. Sem estes dois, este arquivo mediria a guarda em vez da leitura.
  restaurarAmbiente = isolarAmbiente();
  process.env['GOOGLE_CLIENT_ID'] = CLIENT_ID_DE_TESTE;
  process.env['REBECA_ALLOWED_SUBS'] = SUB_AUTORIZADO;

  tempDir = mkdtempSync(join(tmpdir(), 'rebeca-media-library-'));
  process.env['REBECA_ASSETS_ROOT'] = join(tempDir, 'assets');
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
  delete process.env['REBECA_ASSETS_ROOT'];
  restaurarAmbiente();
});

/** Escreve o arquivo do ativo na raiz de ativos, para `existsOnDisk` ter o que medir. */
function createFile(pathFromAssets: string, content: string): void {
  const target = join(assetsRoot(), pathFromAssets);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content, 'utf8');
}

function makeAsset(overrides: Partial<MediaAsset> & Pick<MediaAsset, 'stage' | 'key' | 'pathFromAssets'>): MediaAsset {
  return {
    channelId: 'luna',
    episodeId: 'luna-ep-001',
    kind: 'video',
    version: 1,
    path: `.rebeca/assets/${overrides.pathFromAssets}`,
    hash: 'deadbeef',
    sha256: 'a'.repeat(64),
    durationMs: 10_000,
    bytes: 1024,
    providerId: 'simulado-animacao',
    model: 'ffmpeg-zoompan-1',
    promptVersion: 'criar-cena@v1',
    costUsd: 0,
    simulated: true,
    reference: 'sintetica',
    approved: false,
    recordedAt: AGORA.toISOString(),
    ...overrides,
  };
}

/**
 * Um episódio completo na pasta de um canal: manifesto + arquivos no disco.
 *
 * Usa o **escritor real** (`writeManifest`), não JSON na mão: assim o teste cobre o par
 * escreve/ler de verdade, e uma mudança de formato no manifesto aparece aqui em vez de passar batido.
 */
function seedEpisode(
  options: { channelId?: string; episodeId?: string; omitFile?: boolean; costUsd?: number } = {},
): {
  channelId: string;
  episodeId: string;
} {
  const channelId = options.channelId ?? 'luna';
  const episodeId = options.episodeId ?? 'luna-ep-001';

  const assets: MediaAsset[] = [
    makeAsset({
      channelId,
      episodeId,
      stage: 'imagem',
      key: 'cena-01',
      kind: 'imagem',
      pathFromAssets: `${channelId}/${episodeId}/imagem/cena-01-657ac48d.png`,
      durationMs: 0,
      providerId: 'simulado-imagem',
      costUsd: 0,
    }),
    makeAsset({
      channelId,
      episodeId,
      stage: 'render',
      key: 'longo',
      version: 1,
      pathFromAssets: `${channelId}/${episodeId}/render/v1/${episodeId}-16x9-v1.mp4`,
      durationMs: 27_033,
      providerId: 'ffmpeg',
      model: 'libx264-crf18-loudnorm2pass',
      promptVersion: 'render-v1',
      costUsd: options.costUsd ?? 0,
    }),
  ];

  const manifest = upsertAssets(emptyManifest(channelId, episodeId, episodeId, AGORA), assets, AGORA);
  writeManifest(manifest, channelId);

  // Os dois arquivos no disco, exceto quando o teste quer provocar o "manifesto aponta para o vazio".
  if (options.omitFile !== true) {
    for (const asset of assets) createFile(asset.pathFromAssets, 'conteúdo');
  }

  return { channelId, episodeId };
}

describe('leitura da mídia gerada', () => {
  it('diz que não há mídia — com o motivo — quando o canal não tem pasta de ativos', () => {
    const library = readLibrary('luna');

    expect(library.available).toBe(false);
    expect(library.episodes).toEqual([]);
    // O motivo tem de explicar o .gitignore: é o que faz a ausência deixar de parecer defeito.
    expect(library.reason).toContain('.gitignore');
    expect(library.reason).toBe(MOTIVO_SEM_MIDIA);
  });

  it('encontra o episódio gerado e conta os ativos', () => {
    seedEpisode();

    const library = readLibrary('luna');

    expect(library.available).toBe(true);
    expect(library.reason).toBeNull();
    expect(library.episodes).toHaveLength(1);
    expect(library.episodes[0]?.episodeId).toBe('luna-ep-001');
    expect(library.episodes[0]?.assetCount).toBe(2);
    expect(library.episodes[0]?.missingCount).toBe(0);
    expect(library.episodes[0]?.simulatedCount).toBe(2);
    // Fase 0: o custo real é 0 porque o ffmpeg local custa zero. Zero é a verdade, não ausência de dado.
    expect(library.episodes[0]?.totalCostUsd).toBe(0);
    expect(library.episodes[0]?.renderVersion).toBe(1);
    expect(library.episodes[0]?.characterSheet).toBe('ausente');
  });

  /**
   * O teste que mais importa: o manifesto registra o que **foi** gerado; o arquivo pode não existir mais.
   * Sem medir o disco, a tela afirma "gerado" sobre um caminho quebrado — exatamente o defeito que a tela
   * de Revisão já teve uma vez (checkmark verde sobre arquivos que não existiam).
   */
  it('marca o ativo como ausente quando o arquivo do manifesto não está mais no disco', () => {
    seedEpisode({ omitFile: true });

    const view = readEpisodeView('luna', 'luna-ep-001');

    expect(view).not.toBeNull();
    expect(view?.assetCount).toBe(2);
    expect(view?.missingCount).toBe(2);
    expect(view?.assets.every((asset) => asset.existsOnDisk === false)).toBe(true);
    // O tamanho somado não inclui o que não existe: somar o ausente seria inventar byte.
    expect(view?.totalBytes).toBe(0);
  });

  it('marca como presente só o que está de fato no disco', () => {
    seedEpisode();
    // Apaga o arquivo do render, mantendo a imagem.
    rmSync(join(assetsRoot(), 'luna/luna-ep-001/render/v1/luna-ep-001-16x9-v1.mp4'));

    const view = readEpisodeView('luna', 'luna-ep-001');
    const imagem = view?.assets.find((asset) => asset.stage === 'imagem');
    const render = view?.assets.find((asset) => asset.stage === 'render');

    expect(imagem?.existsOnDisk).toBe(true);
    expect(render?.existsOnDisk).toBe(false);
    expect(view?.missingCount).toBe(1);
    // Sobra só a imagem, que tem duração 0. A duração do render apagado NÃO entra: dizer "27 s de vídeo"
    // quando não há vídeo para abrir é a mesma família de mentira que esta tela corrige.
    expect(view?.totalDurationMs).toBe(0);
    expect(render?.bytes).toBe(0);
  });

  /**
   * A outra metade da distinção — e a que seria fácil errar para o lado errado.
   *
   * `bytes` e duração descrevem **o que está no disco**; custo e procedência descrevem **o que
   * aconteceu**. Apagar o arquivo não devolve o dinheiro gasto: um custo que some junto com o arquivo
   * seria um livro de custos que mente, e a pergunta "esse conteúdo valeu a pena?" ficaria sem resposta
   * exatamente quando o ativo foi perdido.
   */
  it('conta o custo real mesmo quando o arquivo pago não está mais no disco', () => {
    seedEpisode({ costUsd: 4.2 });
    rmSync(join(assetsRoot(), 'luna/luna-ep-001/render/v1/luna-ep-001-16x9-v1.mp4'));

    const view = readEpisodeView('luna', 'luna-ep-001');
    const imagem = view?.assets.find((asset) => asset.stage === 'imagem');
    const render = view?.assets.find((asset) => asset.stage === 'render');

    expect(view?.missingCount).toBe(1);
    // O render apagado contribui 0 byte; a imagem presente continua contando.
    expect(render?.bytes).toBe(0);
    expect(imagem?.bytes).toBeGreaterThan(0);
    expect(view?.totalBytes).toBe(imagem?.bytes);
    expect(view?.totalDurationMs).toBe(0);
    // O gasto aconteceu. Ele não desaparece com o arquivo.
    expect(view?.totalCostUsd).toBeCloseTo(4.2, 6);
    expect(view?.simulatedCount).toBe(2);
  });

  it('devolve a visão sem caminho absoluto — só o relativo à raiz de ativos', () => {
    seedEpisode();

    const view = readEpisodeView('luna', 'luna-ep-001');
    const serialized = JSON.stringify(view);

    expect(serialized).toContain('luna/luna-ep-001/render/v1/luna-ep-001-16x9-v1.mp4');
    // Caminho de máquina na resposta é vazamento de ambiente sem nenhum ganho para a tela.
    expect(serialized).not.toContain(tempDir.replaceAll('\\', '\\\\'));
    expect(serialized).not.toContain(tempDir);
  });
});

describe('isolamento entre canais na leitura', () => {
  it('não enxerga o episódio de um canal quando perguntam por outro', () => {
    seedEpisode({ channelId: 'luna', episodeId: 'luna-ep-001' });

    // O mesmo `episodeId`, pedido no canal errado: o caminho nem existe na pasta do outro canal.
    expect(readEpisodeView('arquivo', 'luna-ep-001')).toBeNull();
    expect(listChannelEpisodes('arquivo')).toEqual([]);

    const library = readLibrary('arquivo');
    expect(library.available).toBe(false);
    expect(library.episodes).toEqual([]);
  });

  /**
   * O manifesto copiado: pasta do canal B, conteúdo dizendo que é do canal A. O caminho está no lugar
   * certo, então só a checagem do `channelId` interno pega. Sem ela, um manifesto copiado exporia ativo
   * de outro canal pela porta da frente.
   */
  it('recusa manifesto cujo dono declarado é outro canal', () => {
    seedEpisode({ channelId: 'arquivo', episodeId: 'luna-ep-001' });

    // Reescreve o manifesto na pasta de "luna" com o corpo dizendo que é de "arquivo" — o cenário da
    // cópia manual, que o `writeManifest` recusaria (ele valida o escopo na escrita).
    const path = join(assetsRoot(), 'luna/luna-ep-001/meta.json');
    mkdirSync(dirname(path), { recursive: true });
    const original = readManifest('arquivo', 'arquivo', 'luna-ep-001');
    expect(original).not.toBeNull();
    writeFileSync(path, `${JSON.stringify(original, null, 2)}\n`, 'utf8');

    expect(readEpisodeView('luna', 'luna-ep-001')).toBeNull();
    expect(listChannelEpisodes('luna')).toEqual([]);
    expect(readLibrary('luna').available).toBe(false);
  });

  it('recusa identificador de canal com travessia antes de tocar o disco', () => {
    for (const ruim of ['..', '../etc', 'a/b', 'C:', 'Luna']) {
      expect(() => readLibrary(ruim)).toThrowError(ChannelScopeError);
    }
  });

  it('ignora pasta sem manifesto — arquivo solto não é episódio gerado', () => {
    seedEpisode();
    mkdirSync(join(assetsRoot(), 'luna/luna-ep-orfao'), { recursive: true });

    const library = readLibrary('luna');

    expect(library.episodes.map((episode) => episode.episodeId)).toEqual(['luna-ep-001']);
  });
});

describe('rota HTTP da mídia', () => {
  const vazio = new URLSearchParams();

  it('recusa pedido sem canal — não existe leitura de mídia fora de um canal', async () => {
    const result = await routeMediaRequest('GET', '/api/media/episodes', vazio);

    expect(result.status).toBe(400);
    expect((result.body as { code: string }).code).toBe('canal-obrigatorio');
  });

  it('recusa verbo que não seja GET', async () => {
    const result = await routeMediaRequest('POST', '/api/media/episodes', new URLSearchParams({ channelId: 'luna' }));

    expect(result.status).toBe(405);
  });

  it('responde a lista do canal', async () => {
    seedEpisode();

    const result = await routeMediaRequest('GET', '/api/media/episodes', new URLSearchParams({ channelId: 'luna' }));

    expect(result.status).toBe(200);
    const body = result.body as { available: boolean; episodes: unknown[] };
    expect(body.available).toBe(true);
    expect(body.episodes).toHaveLength(1);
  });

  it('exige o episódio na leitura de um episódio', async () => {
    const result = await routeMediaRequest('GET', '/api/media/episode', new URLSearchParams({ channelId: 'luna' }));

    expect(result.status).toBe(400);
    expect((result.body as { code: string }).code).toBe('episodio-obrigatorio');
  });

  it('responde 404 — não 200 vazio — quando o episódio não tem manifesto', async () => {
    const result = await routeMediaRequest(
      'GET',
      '/api/media/episode',
      new URLSearchParams({ channelId: 'luna', episodeId: 'luna-ep-001' }),
    );

    expect(result.status).toBe(404);
    expect((result.body as { code: string }).code).toBe('episodio-sem-manifesto');
  });

  it('devolve o episódio com os ativos e a presença no disco', async () => {
    seedEpisode();

    const result = await routeMediaRequest(
      'GET',
      '/api/media/episode',
      new URLSearchParams({ channelId: 'luna', episodeId: 'luna-ep-001' }),
    );

    expect(result.status).toBe(200);
    const body = result.body as { assets: Array<{ existsOnDisk: boolean; simulated: boolean }>; limits: unknown };
    expect(body.assets).toHaveLength(2);
    // O rótulo de simulado viaja junto: é ele que impede a tela de apresentar a Fase 0 como arte real.
    expect(body.assets.every((asset) => asset.simulated)).toBe(true);
    expect(body.assets.every((asset) => asset.existsOnDisk)).toBe(true);
    expect(body.limits).toBeDefined();
  });

  it('trata canal malformado como pedido ruim (400), não como falha do servidor (500)', async () => {
    const result = await routeMediaRequest('GET', '/api/media/episodes', new URLSearchParams({ channelId: '..' }));

    expect(result.status).toBe(400);
    expect((result.body as { code: string }).code).toBe('segmento-invalido');
  });

  it('responde 404 em rota desconhecida sob o prefixo', async () => {
    const result = await routeMediaRequest('GET', '/api/media/qualquer', new URLSearchParams({ channelId: 'luna' }));

    expect(result.status).toBe(404);
    expect((result.body as { code: string }).code).toBe('rota-desconhecida');
  });

  it('nunca devolve HTML — erro também é JSON', async () => {
    const result = await routeMediaRequest('GET', '/api/media/episodes', vazio);

    expect(typeof result.body).toBe('object');
    expect(result.body).not.toBeNull();
  });
});
