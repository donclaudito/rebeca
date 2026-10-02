/**
 * Fase 2 — a imagem: da cena escrita ao arquivo no disco, com o provedor real da MiniMax.
 *
 * O que este arquivo existe para provar, e por quê:
 *
 * 1. **A cena vira PNG de verdade.** O adapter real (`image-01`) recebe `ImageRequest`, fala com o
 *    endpoint documentado e grava o arquivo **na pasta do canal**. Sem isso, "Fase 2" seria uma
 *    interface bonita sem arquivo nenhum.
 * 2. **Idempotência antes do gasto.** Rodar duas vezes não pode gerar arquivo novo nem linha nova no
 *    livro — e a prova é mais forte do que "o manifesto bateu": a **rede não é chamada** na segunda vez.
 *    Um teste que só conta arquivos passaria com o adapter pagando de novo e sobrescrevendo o mesmo nome.
 * 3. **Portão de fornecedor antes de qualquer rede.** Fornecedor fora da allow-list é recusado com o
 *    fundamento na mensagem, e `fetch` **não** é chamado. É o caso que a prova adversarial por mutação
 *    derruba de propósito (ver `.rebeca/evidencias/fase-2-imagens.txt`).
 * 4. **Sem chave, cai no simulado — e DIZ isso.** O defeito que este projeto já pagou duas vezes é
 *    apresentar prova de máquina (texto do ffmpeg sobre fundo chapado) como arte do canal. Por isso o
 *    teste não confere só `simulated: true`: confere a **frase** que a resposta carrega.
 * 5. **Custo real no livro.** Imagem gerada entra em `.rebeca/custos.csv` com o preço publicado; imagem
 *    reusada não gera linha.
 *
 * Tudo em `REBECA_ROOT`, `REBECA_ASSETS_ROOT` e `REBECA_COST_LEDGER` temporários: a suíte não escreve na
 * árvore de ativos nem no livro do projeto, que tem outros escritores (D9).
 */

import { deflateSync } from 'node:zlib';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AssetPlan, GeneratedAsset, ImageProvider, ImageRequest, ThumbnailRequest } from '../contract.js';
import { assetPath, ChannelScopeError } from '../../../server/media/paths.js';
import { ffmpegAvailable } from '../../../server/media/ffmpeg.js';
import { ledgerRowCount, readLedger } from '../../../server/media/ledger.js';
import {
  declaredUnitPriceUsd,
  imageProviderNotice,
  planImageFor,
  pngSize,
  resolveImageProvider,
} from '../../../server/media/providers/image-provider.js';
import {
  MINIMAX_COST_PER_IMAGE_USD,
  MINIMAX_PROMPT_MAX_CHARS,
  miniMaxImageProvider,
  miniMaxThumbnailProvider,
  planMiniMaxImage,
} from '../../../server/media/providers/minimax.js';
import {
  planImage,
  SIMULATED_MODELS,
  simulatedImageProvider,
} from '../../../server/media/providers/simulated.js';
import type { EpisodeSpec } from '../../../server/media/simulated-episode.js';
import { resetMemoryLedger } from '../../../server/ai/ledger.js';

const HAS_FFMPEG = ffmpegAvailable();
const TIMEOUT = 300_000;

let tempDir = '';

/* =============================================================================
   PNG de verdade, sem ffmpeg
   ============================================================================= */

/**
 * Um PNG **válido** de verdade (IHDR + IDAT deflate + IEND, com CRC), cor sólida.
 *
 * Foi preciso escrever isto porque o teste não pode depender do ffmpeg para medir o adapter, e porque o
 * arquivo sintético tem de ser **decodificável**: a etapa seguinte do pipeline (o clipe) abre a imagem com
 * o ffmpeg. Um PNG só com a assinatura — que é o que o teste da thumbnail usa — passaria no `assertImageBytes`
 * e quebraria o render, que é exatamente o tipo de teste que mede a coisa errada.
 */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = (c & 1) === 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();
function crc32(bytes: Buffer): number {
  let c = 0xffffffff;
  for (const byte of bytes) c = (CRC_TABLE[(c ^ byte) & 0xff] ?? 0) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const tipo = Buffer.from(type, 'latin1');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([tipo, data])), 0);
  return Buffer.concat([length, tipo, data, crc]);
}

function pngSolido(width: number, height: number, rgb: readonly [number, number, number]): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 8 bits por canal
  ihdr[9] = 2; // truecolor RGB
  // 10 (compressão), 11 (filtro) e 12 (entrelace) ficam 0: deflate, adaptativo, sem entrelace.
  const linha = Buffer.alloc(1 + width * 3);
  for (let x = 0; x < width; x += 1) {
    linha[1 + x * 3] = rgb[0];
    linha[2 + x * 3] = rgb[1];
    linha[3 + x * 3] = rgb[2];
  }
  const cru = Buffer.concat(Array.from({ length: height }, () => linha));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(cru)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** O que a doc declara para `16:9`: 1280x720 nativo. O render do episódio é 1920x1080 e amplia. */
const PNG_DO_PROVEDOR = pngSolido(1280, 720, [30, 41, 59]);

/**
 * PNG montado campo a campo — para os casos que a validação **tem** de recusar (QA-016).
 *
 * Todos saem estruturalmente íntegros: assinatura, chunks com CRC correto, `IDAT` que descomprime e
 * `IEND`. O que muda é o que o `IHDR` declara (ou quantos pixels vêm no `IDAT`) — que é exatamente o
 * ponto cego que a camada 1 tinha.
 */
function pngEstrutural(opcoes: {
  readonly width: number;
  readonly height: number;
  readonly bitDepth?: number;
  readonly colorType?: number;
  readonly interlace?: number;
  readonly pixelsCrus: Buffer;
}): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(opcoes.width, 0);
  ihdr.writeUInt32BE(opcoes.height, 4);
  ihdr[8] = opcoes.bitDepth ?? 8;
  ihdr[9] = opcoes.colorType ?? 2;
  ihdr[12] = opcoes.interlace ?? 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(opcoes.pixelsCrus)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* =============================================================================
   Ambiente isolado
   ============================================================================= */

const PEDIDO: ImageRequest = {
  channelId: 'luna',
  scopeChannelId: 'luna',
  episodeId: 'luna-ep-imagens',
  promptVersion: 'criar-cena@v1',
  sceneId: 'cena-01',
  prompt: 'Referência sintética: personagem pequena em um jardim claro, formas suaves.',
  onScreenText: 'Cena 1 — teste',
  width: 1920,
  height: 1080,
  seed: 101,
};

function entradaAllowList(
  fornecedor: string,
  modelo: string,
  finalidade: string,
  status = 'PERMITIDO',
): Record<string, string | null> {
  return {
    fornecedor,
    modelo,
    finalidade,
    status,
    fundamento: 'teste: procedência declarada pelo próprio teste',
    fonteUrl: 'https://exemplo.invalido/termos',
    lidoEm: '2026-10-02',
    aprovadoPor: 'humano:teste',
    aprovadoEm: '2026-10-02',
  };
}

/**
 * O que a allow-list de produção da Luna registra para as etapas que **não** são a imagem paga: os
 * provedores simulados, mais o próprio simulado de imagem (que é quem gera quando não há chave).
 */
const ALLOW_LIST_BASE: Array<Record<string, string | null>> = [
  entradaAllowList('simulado-imagem', SIMULATED_MODELS.image, 'imagem'),
  entradaAllowList('simulado-animacao', SIMULATED_MODELS.video, 'animacao'),
  entradaAllowList('simulado-voz', SIMULATED_MODELS.tts, 'voz'),
  entradaAllowList('simulado-musica', SIMULATED_MODELS.music, 'musica'),
];

/** Com a MiniMax de imagem permitida — a entrada que a allow-list da Luna ganhou em 2026-10-02. */
const ALLOW_LIST_COM_IMAGEM: Array<Record<string, string | null>> = [
  ...ALLOW_LIST_BASE,
  entradaAllowList('minimax', 'image-01', 'imagem'),
];

function escreverAllowList(entradas: Array<Record<string, string | null>>): void {
  const path = join(tempDir, '.rebeca', 'canais', 'luna', 'allow-list.json');
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(
    path,
    JSON.stringify(
      { canal: 'luna', nome: 'Luna', publico: 'infantil', atualizadoEm: '2026-10-02', fonte: 'teste', regra: 'teste', entradas },
      null,
      2,
    ),
    'utf8',
  );
}

/** Episódio curto: o que está sob teste é o caminho da imagem, não o volume. */
const EPISODIO_DE_TESTE: EpisodeSpec = {
  channelId: 'luna',
  channelName: 'Luna e o Jardim das Cores',
  episodeId: 'luna-ep-imagens',
  slug: 'luna-ep-imagens',
  title: 'Episódio de teste da Fase 2 (referência sintética)',
  voiceId: 'voz-simulada-ptbr',
  musicMood: 'leve',
  promptVersion: 'criar-cena@v1',
  scenes: [
    {
      id: 'cena-01',
      index: 1,
      narration: 'Luna abre a janela e vê o jardim.',
      onScreenText: 'Cena 1 — teste',
      imagePrompt: 'Referência sintética: personagem em um jardim claro.',
      emotion: 'curiosidade',
      seed: 101,
    },
    {
      id: 'cena-02',
      index: 2,
      narration: 'Ela corre para contar ao Bento.',
      onScreenText: 'Cena 2 — teste',
      imagePrompt: 'Referência sintética: personagem correndo no jardim.',
      emotion: 'alegria',
      seed: 202,
    },
  ],
};

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'rebeca-imagens-'));
  process.env['REBECA_ROOT'] = tempDir;
  process.env['REBECA_COST_LEDGER'] = join(tempDir, 'custos.csv');
  process.env['REBECA_ASSETS_ROOT'] = join(tempDir, 'assets');
  delete process.env['REBECA_MINIMAX_API_KEY'];
  escreverAllowList(ALLOW_LIST_COM_IMAGEM);
  resetMemoryLedger();
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
  delete process.env['REBECA_ROOT'];
  delete process.env['REBECA_COST_LEDGER'];
  delete process.env['REBECA_ASSETS_ROOT'];
  delete process.env['REBECA_MINIMAX_API_KEY'];
  resetMemoryLedger();
  vi.unstubAllGlobals();
});

/** Resposta de sucesso no formato documentado, com a imagem em base64. */
function respostaOk(png: Buffer = PNG_DO_PROVEDOR): Record<string, unknown> {
  return {
    id: 'trace-imagem-1',
    data: { image_base64: [png.toString('base64')] },
    metadata: { success_count: 1, failed_count: 0 },
    base_resp: { status_code: 0, status_msg: 'success' },
  };
}

function stubFetch(corpo: unknown, status = 200) {
  const mock = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify(corpo), { status }));
  vi.stubGlobal('fetch', mock);
  return mock;
}

function arquivosGerados(): string[] {
  const raiz = join(tempDir, 'assets');
  if (!existsSync(raiz)) return [];
  return readdirSync(raiz, { recursive: true, encoding: 'utf8' })
    .map((item) => item.replaceAll('\\', '/'))
    .sort();
}

/** As linhas do livro cuja etapa é a imagem — o recorte que a Fase 2 acrescenta. */
function linhasDeImagem(): Array<Record<string, string>> {
  const { header, rows } = readLedger();
  const etapa = header.indexOf('etapa');
  return rows
    .filter((row) => (row[etapa] ?? '').trim() === 'imagem')
    .map((row) => Object.fromEntries(header.map((coluna, index) => [coluna, row[index] ?? ''])));
}

/* =============================================================================
   O adapter real — contrato, preço e idempotência
   ============================================================================= */

describe('adapter real da MiniMax para imagem de cena (image-01)', () => {
  it('sem chave, recusa com instrução e NÃO toca a rede', async () => {
    const fetchMock = stubFetch(respostaOk());

    await expect(miniMaxImageProvider.render(PEDIDO)).rejects.toThrowError(/Não há chave da MiniMax/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('grava o PNG na pasta do canal, cobra o preço publicado e envia o contrato documentado', async () => {
    process.env['REBECA_MINIMAX_API_KEY'] = 'chave-de-teste-nao-real';
    const fetchMock = stubFetch(respostaOk());

    const asset = await miniMaxImageProvider.render(PEDIDO);
    const plano = planMiniMaxImage(PEDIDO);

    // 1. O arquivo existe, é PNG, e nasceu **na pasta do canal** (invariante nº 2).
    expect(asset.path).toBe(plano.path);
    expect(existsSync(asset.path)).toBe(true);
    expect(asset.path.replaceAll('\\', '/')).toContain('/luna/luna-ep-imagens/imagem/cena-01-');
    expect(readFileSync(asset.path).length).toBe(PNG_DO_PROVEDOR.length);
    // A resolução é MEDIDA do arquivo, não presumida do pedido: pedimos 1920x1080 e a doc entrega
    // 1280x720 no `16:9`. Se o provedor mudar isso, o teste cai — e é o que queremos que ele faça.
    expect(pngSize(asset.path)).toEqual({ width: 1280, height: 720 });

    // 2. Custo REAL, do preço publicado (não zero, não estimado).
    expect(asset.simulated).toBe(false);
    expect(asset.costUsd).toBeCloseTo(MINIMAX_COST_PER_IMAGE_USD, 10);
    expect(asset.providerId).toBe('minimax');
    expect(asset.model).toBe('image-01');

    // 3. O corpo enviado é o do OpenAPI oficial: base64 (a URL expira em 24h e quebraria a idempotência),
    //    `image-01`, proporção 16:9 e a seed pedida (reprodutibilidade declarada na doc).
    const corpo = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as Record<string, unknown>;
    expect(corpo['model']).toBe('image-01');
    expect(corpo['aspect_ratio']).toBe('16:9');
    expect(corpo['response_format']).toBe('base64');
    expect(corpo['n']).toBe(1);
    expect(corpo['seed']).toBe(PEDIDO.seed);
    expect(corpo['prompt_optimizer']).toBe(false);
    // O rótulo da cena é metadado nosso, não texto de arte: não pode virar legenda dentro do desenho.
    expect(String(corpo['prompt'])).not.toContain(PEDIDO.onScreenText);
    expect(String(corpo['prompt'])).toContain('Do not add any text');
  });

  it('idempotência antes do gasto: a segunda chamada não chama a rede e devolve custo zero', async () => {
    process.env['REBECA_MINIMAX_API_KEY'] = 'chave-de-teste-nao-real';
    const fetchMock = stubFetch(respostaOk());

    const primeira = await miniMaxImageProvider.render(PEDIDO);
    const segunda = await miniMaxImageProvider.render(PEDIDO);

    expect(segunda.path).toBe(primeira.path);
    expect(segunda.costUsd).toBe(0);
    // A prova que importa: **uma** requisição para duas execuções. Contar arquivos não provaria isso.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('traduz erro de saldo mesmo com HTTP 200 — e não grava arquivo nenhum', async () => {
    process.env['REBECA_MINIMAX_API_KEY'] = 'chave-de-teste-nao-real';
    stubFetch({ base_resp: { status_code: 1008, status_msg: 'insufficient balance' } });

    await expect(miniMaxImageProvider.render(PEDIDO)).rejects.toThrowError(/Saldo insuficiente/);
    expect(existsSync(planMiniMaxImage(PEDIDO).path)).toBe(false);
  });

  it('recusa sucesso sem imagem, citando o contador de bloqueio, em vez de gravar arquivo vazio', async () => {
    process.env['REBECA_MINIMAX_API_KEY'] = 'chave-de-teste-nao-real';
    stubFetch({
      data: { image_base64: [] },
      metadata: { success_count: 0, failed_count: 1 },
      base_resp: { status_code: 0, status_msg: 'success' },
    });

    await expect(miniMaxImageProvider.render(PEDIDO)).rejects.toThrowError(/failed_count=1/);
    expect(existsSync(planMiniMaxImage(PEDIDO).path)).toBe(false);
  });

  it('recusa prompt acima do limite documentado ANTES da rede, em vez de deixar o provedor truncar', async () => {
    process.env['REBECA_MINIMAX_API_KEY'] = 'chave-de-teste-nao-real';
    const fetchMock = stubFetch(respostaOk());

    const longo: ImageRequest = { ...PEDIDO, sceneId: 'cena-longa', prompt: 'a'.repeat(MINIMAX_PROMPT_MAX_CHARS) };
    await expect(miniMaxImageProvider.render(longo)).rejects.toThrowError(/limite documentado da MiniMax é 1500/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('recusa proporção que a API não aceita ANTES da rede', async () => {
    process.env['REBECA_MINIMAX_API_KEY'] = 'chave-de-teste-nao-real';
    const fetchMock = stubFetch(respostaOk());

    const estranha: ImageRequest = { ...PEDIDO, width: 1920, height: 1000 };
    await expect(miniMaxImageProvider.render(estranha)).rejects.toThrowError(/não corresponde a nenhuma/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('não grava imagem de um canal na pasta de outro — recusa antes da rede', async () => {
    process.env['REBECA_MINIMAX_API_KEY'] = 'chave-de-teste-nao-real';
    const fetchMock = stubFetch(respostaOk());

    const deOutroCanal: ImageRequest = { ...PEDIDO, channelId: 'outro-canal' };
    await expect(miniMaxImageProvider.render(deOutroCanal)).rejects.toBeInstanceOf(ChannelScopeError);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(arquivosGerados()).toEqual([]);
  });
});

/* =============================================================================
   Seleção por configuração e plano por provedor
   ============================================================================= */

describe('seleção do provedor de imagem por configuração', () => {
  it('sem chave, resolve o simulado e a resposta DIZ que é prova de máquina', () => {
    const escolha = resolveImageProvider();

    expect(escolha.provider.id).toBe('simulado-imagem');
    expect(escolha.notice.simulated).toBe(true);
    expect(escolha.notice.costPerImageUsd).toBe(0);
    // O que impede a mentira de produto: a frase, não só o booleano.
    expect(escolha.notice.motivo).toMatch(/Prova de máquina, NÃO arte/);
    expect(escolha.notice.motivo).toContain('ffmpeg');
    expect(escolha.origem).toMatch(/Não há chave da MiniMax/);
    // Sem provedor de IA de terceiro, não há rótulo de deep synthesis a exigir.
    expect(escolha.notice.deepSynthesis.required).toBe(false);
  });

  it('com chave, resolve a MiniMax e declara o rótulo de deep synthesis com a redação NÃO VERIFICADA', () => {
    process.env['REBECA_MINIMAX_API_KEY'] = 'chave-de-teste-nao-real';

    const escolha = resolveImageProvider();

    expect(escolha.provider.id).toBe('minimax');
    expect(escolha.notice.simulated).toBe(false);
    expect(escolha.notice.costPerImageUsd).toBeCloseTo(MINIMAX_COST_PER_IMAGE_USD, 10);
    expect(escolha.notice.motivo).toMatch(/1280x720/);

    // O `ADR-005` exige o rótulo — e o TEXTO dele segue não verificado em fonte primária. O teste fixa
    // isso: se alguém "resolver" o rótulo inventando uma frase, este `null` vira string e o teste cai.
    expect(escolha.notice.deepSynthesis.required).toBe(true);
    expect(escolha.notice.deepSynthesis.text).toBeNull();
    expect(escolha.notice.deepSynthesis.note).toMatch(/NÃO VERIFICADO/);
  });

  it('provedor real desconhecido não herda nem o preço nem o rótulo de ninguém', () => {
    const outro: ImageProvider = {
      id: 'provedor-real-desconhecido',
      model: 'modelo-x',
      simulated: false,
      render: (): Promise<GeneratedAsset> => Promise.reject(new Error('não usado')),
    };

    const aviso = imageProviderNotice(outro);
    expect(aviso.costPerImageUsd).toBeNull();
    expect(aviso.deepSynthesis.required).toBe(false);
    expect(aviso.motivo).toMatch(/NÃO VERIFICADOS/);
  });

  it('o preço declarado separa "de graça" (simulado) de "não verificado" (pago sem preço)', () => {
    const pagoSemPreco: ImageProvider = {
      id: 'pago-sem-preco',
      model: 'm',
      simulated: false,
      render: (): Promise<GeneratedAsset> => Promise.reject(new Error('não usado')),
    };

    expect(declaredUnitPriceUsd(simulatedImageProvider)).toBe(0);
    expect(declaredUnitPriceUsd(miniMaxImageProvider)).toBeCloseTo(MINIMAX_COST_PER_IMAGE_USD, 10);
    expect(declaredUnitPriceUsd(pagoSemPreco)).toBeNull();
  });

  it('o plano da cena vem do provedor que vai gerar — arte e prova de máquina não disputam o mesmo arquivo', () => {
    const doSimulado = planImageFor(simulatedImageProvider, PEDIDO);
    const daMiniMax = planImageFor(miniMaxImageProvider, PEDIDO);

    // O simulado segue usando o plano canônico dele: nada mudou para a Fase 0/1.
    expect(doSimulado.hash).toBe(planImage(PEDIDO).hash);
    // E o real tem hash e caminho próprios: é isso que impede a reexecução de servir o PNG do ffmpeg
    // achando que é arte paga (e o inverso, que é pior).
    expect(daMiniMax.hash).not.toBe(doSimulado.hash);
    expect(daMiniMax.path).not.toBe(doSimulado.path);
    expect(daMiniMax.sha256).not.toBe(doSimulado.sha256);
  });

  it('provedor real que não sabe planejar é recusado em vez de reusar o plano do simulado', () => {
    const semPlano: ImageProvider = {
      id: 'real-sem-plan',
      model: 'm',
      simulated: false,
      render: (): Promise<GeneratedAsset> => Promise.reject(new Error('não usado')),
    };

    expect(() => planImageFor(semPlano, PEDIDO)).toThrowError(/não declara `plan\(\)`/);
  });

  it('o plano do simulado continua sem `plan` no objeto — é o contrato que não o exige', () => {
    const planner = (simulatedImageProvider as { plan?: (input: ImageRequest) => AssetPlan }).plan;
    expect(planner).toBeUndefined();
  });
});

/* =============================================================================
   O pipeline: allow-list, idempotência e custo com a arte real
   ============================================================================= */

describe('imagem de cena no pipeline — allow-list, idempotência e custo real', () => {
  /**
   * O teste que a prova adversarial por mutação derruba: desligar o laço `assertProviderAllowed` do
   * `runSimulatedEpisode` faz este teste falhar (a geração passa a acontecer com fornecedor fora da
   * allow-list). Ele roda **sem ffmpeg** de propósito: o portão de fornecedor vem antes do
   * `assertFfmpegAvailable()`, e um teste que só passa em máquina com binário mede a máquina, não o
   * produto.
   */
  it('recusa imagem de cena fora da allow-list antes de qualquer chamada de rede', async () => {
    process.env['REBECA_MINIMAX_API_KEY'] = 'chave-de-teste-nao-real';
    escreverAllowList(ALLOW_LIST_BASE); // sem a entrada `minimax / image-01 / imagem`
    const fetchMock = stubFetch(respostaOk());

    const { runSimulatedEpisode } = await import('../../../server/media/simulated-episode.js');
    const { ProviderNotAllowedError } = await import('../../../server/media/allow-list.js');

    const linhasAntes = ledgerRowCount();
    let capturado: unknown = null;
    try {
      await runSimulatedEpisode(EPISODIO_DE_TESTE, { now: new Date('2026-10-02T12:00:00.000Z'), imageProvider: 'auto' });
    } catch (error) {
      capturado = error;
    }

    expect(capturado).toBeInstanceOf(ProviderNotAllowedError);
    expect((capturado as { code?: string }).code).toBe('fornecedor-nao-lista');
    expect(String((capturado as Error).message)).toContain('minimax');
    expect(String((capturado as Error).message)).toContain('imagem');

    // O que o portão existe para garantir: nenhuma chamada de rede, nenhum arquivo, nenhuma linha.
    expect(fetchMock).not.toHaveBeenCalled();
    expect(ledgerRowCount()).toBe(linhasAntes);
    expect(arquivosGerados()).toEqual([]);
  }, TIMEOUT);

  it.skipIf(!HAS_FFMPEG)(
    'a cena vira PNG no disco com custo real no livro — e rodar de novo não gasta nem cria arquivo',
    async () => {
      process.env['REBECA_MINIMAX_API_KEY'] = 'chave-de-teste-nao-real';
      const fetchMock = stubFetch(respostaOk());
      const { runSimulatedEpisode } = await import('../../../server/media/simulated-episode.js');

      // --- primeira execução: arte real, paga, com o provedor escolhido por configuração -----------
      const primeira = await runSimulatedEpisode(EPISODIO_DE_TESTE, {
        now: new Date('2026-10-02T12:00:00.000Z'),
        imageProvider: 'auto',
      });

      const cenas = primeira.assets.filter((asset) => asset.stage === 'imagem');
      expect(cenas).toHaveLength(2);
      expect(cenas.every((asset) => asset.simulated === false)).toBe(true);
      expect(cenas.every((asset) => asset.providerId === 'minimax' && asset.model === 'image-01')).toBe(true);
      expect(cenas.every((asset) => asset.costUsd > 0)).toBe(true);
      // Cena e arquivo casam **por cena**, não por ordem de chegada: cada imagem tem o slug da sua cena.
      // Um pipeline que trocasse as duas não seria pego por uma contagem — só por esta asserção.
      expect(cenas.map((asset) => asset.key)).toEqual(['cena-01', 'cena-02']);
      expect(cenas[0]?.path.replaceAll('\\', '/')).toMatch(/\/imagem\/cena-01-[0-9a-f]{8}\.png$/);
      expect(cenas[1]?.path.replaceAll('\\', '/')).toMatch(/\/imagem\/cena-02-[0-9a-f]{8}\.png$/);
      // Resolução MEDIDA do arquivo em disco (não a pedida): 16:9 entrega 1280x720 e o render amplia.
      expect(cenas.map((asset) => asset.imageSize)).toEqual([
        { width: 1280, height: 720 },
        { width: 1280, height: 720 },
      ]);
      expect(cenas.every((asset) => existsSync(asset.path))).toBe(true);

      // A resposta DIZ qual arte foi usada — e o rótulo do ADR-005 viaja com ela, sem texto inventado.
      expect(primeira.imageProvider.simulated).toBe(false);
      expect(primeira.imageProvider.providerId).toBe('minimax');
      expect(primeira.imageProvider.deepSynthesis.required).toBe(true);
      expect(primeira.imageProvider.deepSynthesis.text).toBeNull();

      // O custo é real, e a execução deixa de ser "toda simulada".
      expect(primeira.cost.simulated).toBe(false);
      expect(primeira.cost.totalUsd).toBeGreaterThan(0);

      // Livro: uma linha por imagem gerada, com o provedor, o modelo e o preço publicado.
      const linhas = linhasDeImagem();
      expect(linhas).toHaveLength(2);
      expect(linhas.every((linha) => linha['provedor'] === 'minimax' && linha['modelo'] === 'image-01')).toBe(true);
      expect(linhas.every((linha) => Number.parseFloat(linha['custo_usd'] ?? '') === MINIMAX_COST_PER_IMAGE_USD)).toBe(true);
      expect(linhas.every((linha) => (linha['prompt_id'] ?? '').includes('#real'))).toBe(true);

      const arquivosPrimeira = arquivosGerados();
      const linhasPrimeira = ledgerRowCount();
      const chamadasPrimeira = fetchMock.mock.calls.length;
      // Duas cenas, duas imagens: o pipeline chama o provedor uma vez por cena (e nunca duas vezes pela
      // mesma), mais nada.
      expect(chamadasPrimeira).toBe(2);

      // --- segunda execução: mesma entrada, mesmo estado -------------------------------------------
      const segunda = await runSimulatedEpisode(EPISODIO_DE_TESTE, {
        now: new Date('2026-10-02T12:05:00.000Z'),
        imageProvider: 'auto',
      });

      expect(segunda.created).toBe(0);
      expect(segunda.reused).toBe(primeira.created);
      // As duas provas de idempotência, as duas verificáveis: nada novo no disco, nada novo no livro —
      // e, o que é mais forte, **nenhuma requisição nova**.
      expect(arquivosGerados()).toEqual(arquivosPrimeira);
      expect(ledgerRowCount()).toBe(linhasPrimeira);
      expect(fetchMock.mock.calls.length).toBe(chamadasPrimeira);
      expect(segunda.cost.totalUsd).toBeCloseTo(primeira.cost.totalUsd, 10);

      // E o arquivo da cena continua sendo uma imagem real de 1280x720 medida no reuso.
      expect(segunda.assets.filter((asset) => asset.stage === 'imagem').every((asset) => asset.reused)).toBe(true);
    },
    TIMEOUT,
  );

  it.skipIf(!HAS_FFMPEG)(
    'sem chave, o episódio cai no simulado e a resposta diz que a imagem é prova de máquina',
    async () => {
      const fetchMock = stubFetch(respostaOk());
      const { runSimulatedEpisode } = await import('../../../server/media/simulated-episode.js');

      const resultado = await runSimulatedEpisode(EPISODIO_DE_TESTE, {
        now: new Date('2026-10-02T12:00:00.000Z'),
        imageProvider: 'auto',
      });

      expect(resultado.imageProvider.simulated).toBe(true);
      expect(resultado.imageProvider.motivo).toMatch(/Prova de máquina, NÃO arte/);
      expect(resultado.assets.filter((asset) => asset.stage === 'imagem').every((asset) => asset.simulated)).toBe(true);
      // Sem arte paga, o custo da execução continua sendo zero — e zero é a verdade, não estimativa.
      expect(resultado.cost.totalUsd).toBe(0);
      expect(resultado.cost.simulated).toBe(true);
      expect(linhasDeImagem()).toHaveLength(2);
      expect(linhasDeImagem().every((linha) => (linha['prompt_id'] ?? '').includes('#simulado'))).toBe(true);
      // O provedor real não foi chamado: sem chave não há requisição, e nada foi cobrado.
      expect(fetchMock).not.toHaveBeenCalled();
    },
    TIMEOUT,
  );

  it.skipIf(!HAS_FFMPEG)(
    'o padrão do pipeline continua sendo o simulado — provedor pago não entra por acidente de ambiente',
    async () => {
      /*
       * Este teste existe por causa de um risco real: a suíte roda em máquina de desenvolvimento, e uma
       * máquina de desenvolvimento pode ter chave da MiniMax configurada. Se o pipeline escolhesse o
       * provedor pago por padrão, `pnpm exec vitest run` passaria a **gastar dinheiro**. Gastar é decisão
       * explícita: o padrão é `'simulado'` e o opt-in é `imageProvider: 'auto'`.
       *
       * A allow-list aqui **permite** a MiniMax de imagem de propósito: assim, se o padrão mudasse, a
       * geração paga aconteceria de verdade (com a rede dublada) e este teste cairia no `fetch` — em vez
       * de cair por política, que seria o motivo errado.
       */
      process.env['REBECA_MINIMAX_API_KEY'] = 'chave-de-teste-nao-real';
      const fetchMock = stubFetch(respostaOk());
      const { runSimulatedEpisode } = await import('../../../server/media/simulated-episode.js');

      const resultado = await runSimulatedEpisode(EPISODIO_DE_TESTE, { now: new Date('2026-10-02T12:00:00.000Z') });

      expect(resultado.imageProvider.simulated).toBe(true);
      expect(resultado.imageProvider.providerId).toBe('simulado-imagem');
      expect(resultado.assets.filter((asset) => asset.stage === 'imagem').every((asset) => asset.simulated)).toBe(true);
      expect(resultado.cost.totalUsd).toBe(0);
      expect(fetchMock).not.toHaveBeenCalled();
    },
    TIMEOUT,
  );
});

/* =============================================================================
   Correções do QA-015 (revisão adversarial) — cada teste morde o defeito que caiu
   ============================================================================= */

describe('QA-015 achado 1 e 8 — integridade do ativo: falha não vira sucesso silencioso', () => {
  const LIXO = Buffer.from('<!doctype html><html>erro do provedor</html>', 'utf8');

  it('achado 1: resposta que não é imagem não deixa arquivo no disco nem vira "sucesso grátis"', async () => {
    /*
     * Reprodução do QA: a primeira chamada lançava e o arquivo **ficava no disco**; a segunda encontrava o
     * arquivo, considerava a idempotência satisfeita e devolvia `costUsd: 0` — sem tocar a rede e sem
     * revalidar. Falha detectada virava sucesso silencioso, e o pipeline registrava no manifesto e montava o
     * clipe em cima do lixo.
     */
    process.env['REBECA_MINIMAX_API_KEY'] = 'chave-de-teste-nao-real';
    const fetchMock = stubFetch(respostaOk(LIXO));
    const path = planMiniMaxImage(PEDIDO).path;

    await expect(miniMaxImageProvider.render(PEDIDO)).rejects.toThrowError(/não é uma imagem/);

    // Nada no destino e nada de arquivo de passagem: não há ativo, e é isso que o disco tem de dizer.
    expect(existsSync(path)).toBe(false);
    expect(existsSync(`${path}.parcial`)).toBe(false);

    // E a segunda tentativa NÃO pode responder "já tenho isso": ela fala com o provedor de novo.
    fetchMock.mockClear();
    await expect(miniMaxImageProvider.render(PEDIDO)).rejects.toThrowError(/não é uma imagem/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(existsSync(path)).toBe(false);
  });

  it('achado 8: PNG truncado que passa pela assinatura é recusado e substituído por imagem inteira', async () => {
    /*
     * O PNG de 33 bytes (assinatura + IHDR) é o fixture do QA: passa na checagem de **3 bytes** e não tem
     * um byte de pixel — o ffmpeg não decodifica, e o `zoompan` do clipe trava por 15 minutos. A resolução
     * medida continua "legível" (1280x720), então medir o cabeçalho não bastava.
     */
    process.env['REBECA_MINIMAX_API_KEY'] = 'chave-de-teste-nao-real';
    const path = planMiniMaxImage(PEDIDO).path;
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, PNG_DO_PROVEDOR.subarray(0, 33));
    expect(pngSize(path)).toEqual({ width: 1280, height: 720 }); // o cabeçalho engana a medição

    const fetchMock = stubFetch(respostaOk(PNG_DO_PROVEDOR));
    const asset = await miniMaxImageProvider.render(PEDIDO);

    // O truncado NÃO contou como ativo: o provedor foi chamado e o arquivo é a imagem inteira.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(asset.costUsd).toBeCloseTo(MINIMAX_COST_PER_IMAGE_USD, 10);
    expect(readFileSync(asset.path).length).toBe(PNG_DO_PROVEDOR.length);

    // A prova de que o arquivo novo **abre**: na chamada seguinte ele é reconhecido como reutilizável.
    fetchMock.mockClear();
    const segunda = await miniMaxImageProvider.render(PEDIDO);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(segunda.costUsd).toBe(0);
  });

  it('o arquivo de passagem não sobrevive a uma falha de validação', async () => {
    process.env['REBECA_MINIMAX_API_KEY'] = 'chave-de-teste-nao-real';
    // PNG com assinatura e IHDR, mas sem IDAT/IEND: a assinatura passa, a conferência estrutural não —
    // e é ela que roda em qualquer ambiente, mesmo sem ffmpeg (a rota de thumbnail pode rodar sem ele).
    stubFetch(respostaOk(PNG_DO_PROVEDOR.subarray(0, 33)));
    const path = planMiniMaxImage(PEDIDO).path;

    await expect(miniMaxImageProvider.render(PEDIDO)).rejects.toThrowError(/está incompleto: não há IDAT/);
    expect(existsSync(path)).toBe(false);
    expect(existsSync(`${path}.parcial`)).toBe(false);
    // A pasta do canal pode existir (foi criada antes da validação), mas **arquivo** nenhum pode sobrar:
    // nem o destino, nem o de passagem. `arquivosGerados` lista diretórios também, então o filtro é por
    // extensão — é o conteúdo que importa.
    expect(arquivosGerados().filter((nome) => /\.(png|parcial)$/.test(nome))).toEqual([]);
  });

  it('achado 7: `failed_count` em string (como no exemplo do OpenAPI) aparece na mensagem', async () => {
    process.env['REBECA_MINIMAX_API_KEY'] = 'chave-de-teste-nao-real';
    stubFetch({
      data: { image_base64: [] },
      metadata: { success_count: '0', failed_count: '1' },
      base_resp: { status_code: 0, status_msg: 'success' },
    });

    // Antes o campo string era descartado e a pista do bloqueio de conteúdo sumia da mensagem.
    await expect(miniMaxImageProvider.render(PEDIDO)).rejects.toThrowError(/failed_count=1/);
  });

  /**
   * O QA apontou o MESMO defeito nas duas finalidades do arquivo (`:393-394` thumbnail e `:557-558`
   * imagem), e as duas usam os mesmos helpers. O teste antigo da thumbnail
   * (`media-thumbnails.test.ts`) não cobre mais isso porque o fixture dele é um PNG de 9 bytes — um
   * arquivo que a validação nova, correta, recusa. Este teste é a cobertura que faltava: a thumbnail
   * real grava, é validada e cobra; e lixo do provedor não deixa arquivo.
   */
  it('a thumbnail real da MiniMax também grava só depois de validar (mesmo helper, outra finalidade)', async () => {
    process.env['REBECA_MINIMAX_API_KEY'] = 'chave-de-teste-nao-real';
    const pedido: ThumbnailRequest = {
      channelId: 'luna',
      scopeChannelId: 'luna',
      episodeId: 'luna-ep-imagens',
      promptVersion: 'criar-thumbnail@v1',
      optionId: 'a',
      prompt: 'flat 2d children illustration',
      textOnImage: 'OLHA ISSO!',
      hypothesis: 'foco no personagem',
      width: 1280,
      height: 720,
      seed: 123,
    };

    const fetchMock = stubFetch(respostaOk(PNG_DO_PROVEDOR));
    const asset = await miniMaxThumbnailProvider.generate(pedido);

    expect(asset.costUsd).toBeCloseTo(MINIMAX_COST_PER_IMAGE_USD, 10);
    expect(asset.simulated).toBe(false);
    expect(existsSync(asset.path)).toBe(true);
    expect(pngSize(asset.path)).toEqual({ width: 1280, height: 720 });

    // E o caminho de erro também não deixa ativo: outro pedido, outro arquivo, resposta que não é imagem.
    const outro: ThumbnailRequest = { ...pedido, optionId: 'b' };
    stubFetch(respostaOk(LIXO));
    const planoB = miniMaxThumbnailProvider.plan(outro);
    await expect(miniMaxThumbnailProvider.generate(outro)).rejects.toThrowError(/não é uma imagem/);
    expect(existsSync(planoB.path)).toBe(false);
    expect(existsSync(`${planoB.path}.parcial`)).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('QA-015 achados 4 e 5 — o ponto de extensão é seguro por si', () => {
  const SHA_VALIDO = 'f'.repeat(64);

  it('achado 4: provedor simulado SEM `plan` não herda o hash nem o caminho do ffmpeg', () => {
    const outroGerador: ImageProvider = {
      id: 'simulado-outro-gerador',
      model: 'outro-gerador-1',
      simulated: true,
      render: (): Promise<GeneratedAsset> => Promise.reject(new Error('não usado')),
    };

    // Recusado — e a mensagem diz que declarar `simulated: true` não empresta o caminho de ninguém.
    expect(() => planImageFor(outroGerador, PEDIDO)).toThrowError(/não empresta o caminho/);
    // O simulado de verdade continua com o plano canônico dele: nada mudou para a Fase 0/1.
    expect(planImageFor(simulatedImageProvider, PEDIDO)).toEqual(planImage(PEDIDO));
  });

  it('achado 5: plano de terceiro fora da pasta do canal é recusado; dentro, é respeitado', () => {
    const terceiro = (caminho: string): ImageProvider & { plan: (input: ImageRequest) => AssetPlan } => ({
      id: 'terceiro-real',
      model: 'modelo-z',
      simulated: false,
      plan: () => ({ hash: 'deadbeef', sha256: SHA_VALIDO, path: caminho }),
      render: (): Promise<GeneratedAsset> => Promise.reject(new Error('não usado')),
    });

    const foraDoCanal = join(tempDir, 'fora', 'canal-alheio.png');
    expect(() => planImageFor(terceiro(foraDoCanal), PEDIDO)).toThrowError(ChannelScopeError);
    expect(() => planImageFor(terceiro(foraDoCanal), PEDIDO)).toThrowError(/fora da pasta do canal/);

    // O ponto de extensão não virou parede: um plano legítimo, dentro do canal, continua valendo.
    const dentroDoCanal = assetPath({
      scopeChannelId: 'luna',
      channelId: 'luna',
      episodeId: PEDIDO.episodeId,
      stage: 'imagem',
      slug: 'cena-01',
      hash8: 'deadbeef',
      ext: 'png',
    });
    expect(planImageFor(terceiro(dentroDoCanal), PEDIDO).path).toBe(dentroDoCanal);
  });

  it('achado 5: hash fora do formato do projeto é recusado (ele vira nome de arquivo e chave de manifesto)', () => {
    const dentroDoCanal = assetPath({
      scopeChannelId: 'luna',
      channelId: 'luna',
      episodeId: PEDIDO.episodeId,
      stage: 'imagem',
      slug: 'cena-01',
      hash8: 'deadbeef',
      ext: 'png',
    });
    const comHashTorto: ImageProvider & { plan: (input: ImageRequest) => AssetPlan } = {
      id: 'terceiro-real',
      model: 'modelo-z',
      simulated: false,
      plan: () => ({ hash: 'zzz', sha256: SHA_VALIDO, path: dentroDoCanal }),
      render: (): Promise<GeneratedAsset> => Promise.reject(new Error('não usado')),
    };

    expect(() => planImageFor(comHashTorto, PEDIDO)).toThrowError(/fora do formato do projeto/);
  });
});

describe('QA-016 achados novos — cabeçalho, pixels e o ambiente sem ffmpeg', () => {
  /*
   * Os quatro achados desta rodada, e o que cada um media:
   *
   *   1. `IHDR 0x0`          → a camada 1 aceitava dimensão zero;
   *   2. `colorType=99`      → aceitava tipo de cor que o formato não define;
   *   3. `bitDepth=7`        → aceitava profundidade de bit inválida;
   *   4. `interlace=7`       → passava nas DUAS camadas e virava o ativo do canal;
   *   5. pixels insuficientes → a camada 1 não conferia se o `IDAT` bastava para as dimensões.
   *
   * O que os quatro primeiros têm em comum: a camada 2 é **condicional** (`if (ffmpegAvailable())`),
   * porque a rota de thumbnail roda em ambiente que pode não ter o binário. Onde ele não existe, a
   * camada 1 é a única defesa — e ela aceitava cabeçalho impossível.
   */
  const CASOS: ReadonlyArray<{ readonly nome: string; readonly bytes: Buffer }> = [
    { nome: 'IHDR 0x0', bytes: pngEstrutural({ width: 0, height: 0, pixelsCrus: Buffer.alloc(8) }) },
    { nome: 'colorType=99', bytes: pngEstrutural({ width: 1, height: 1, colorType: 99, pixelsCrus: Buffer.alloc(4) }) },
    { nome: 'bitDepth=7', bytes: pngEstrutural({ width: 1, height: 1, bitDepth: 7, pixelsCrus: Buffer.alloc(4) }) },
    { nome: 'interlace=7', bytes: pngEstrutural({ width: 1, height: 1, interlace: 7, pixelsCrus: Buffer.alloc(4) }) },
    { nome: 'IDAT sem pixels (1x1 RGB)', bytes: pngEstrutural({ width: 1, height: 1, pixelsCrus: Buffer.alloc(0) }) },
    { nome: 'pixels insuficientes (8x8 RGB com 4 bytes)', bytes: pngEstrutural({ width: 8, height: 8, pixelsCrus: Buffer.alloc(4) }) },
  ];

  it.each(CASOS)('recusa $nome na camada 1 — sem ffmpeg e sem gravar ativo', async ({ bytes }) => {
    process.env['REBECA_MINIMAX_API_KEY'] = 'chave-de-teste-nao-real';
    stubFetch(respostaOk(bytes));
    const path = planMiniMaxImage(PEDIDO).path;

    // A camada 1 é a mesma com e sem ffmpeg: a recusa não pode depender do binário.
    await expect(miniMaxImageProvider.render(PEDIDO)).rejects.toThrowError(/está incompleto/);
    expect(existsSync(path)).toBe(false);
    expect(existsSync(`${path}.parcial`)).toBe(false);
  });

  it.each(CASOS)('recusa $nome mesmo SEM ffmpeg no ambiente (a camada 1 é a única defesa lá)', async ({ bytes }) => {
    process.env['REBECA_MINIMAX_API_KEY'] = 'chave-de-teste-nao-real';
    const { resetFfmpegAvailabilityCache } = await import('../../../server/media/ffmpeg.js');
    const anterior = process.env['REBECA_FFMPEG'];
    process.env['REBECA_FFMPEG'] = 'ffmpeg-que-nao-existe-qa016';
    resetFfmpegAvailabilityCache();
    try {
      stubFetch(respostaOk(bytes));
      const path = planMiniMaxImage(PEDIDO).path;

      await expect(miniMaxImageProvider.render(PEDIDO)).rejects.toThrowError(/está incompleto/);
      expect(existsSync(path)).toBe(false);
    } finally {
      if (anterior === undefined) delete process.env['REBECA_FFMPEG'];
      else process.env['REBECA_FFMPEG'] = anterior;
      resetFfmpegAvailabilityCache();
    }
  });

  it('o controle: o PNG inteiro continua passando nas duas camadas, com e sem ffmpeg', async () => {
    process.env['REBECA_MINIMAX_API_KEY'] = 'chave-de-teste-nao-real';
    const { resetFfmpegAvailabilityCache } = await import('../../../server/media/ffmpeg.js');

    // Com ffmpeg (o caso normal do pipeline).
    const comFfmpeg = stubFetch(respostaOk(PNG_DO_PROVEDOR));
    const asset = await miniMaxImageProvider.render(PEDIDO);
    expect(comFfmpeg).toHaveBeenCalledTimes(1);
    expect(asset.costUsd).toBeCloseTo(MINIMAX_COST_PER_IMAGE_USD, 10);

    // E sem ffmpeg: o mesmo arquivo bom continua sendo aceito — a camada 1 não virou parede.
    rmSync(asset.path, { force: true });
    const anterior = process.env['REBECA_FFMPEG'];
    process.env['REBECA_FFMPEG'] = 'ffmpeg-que-nao-existe-qa016';
    resetFfmpegAvailabilityCache();
    try {
      const semFfmpeg = stubFetch(respostaOk(PNG_DO_PROVEDOR));
      const segundo = await miniMaxImageProvider.render(PEDIDO);
      expect(semFfmpeg).toHaveBeenCalledTimes(1);
      expect(segundo.costUsd).toBeCloseTo(MINIMAX_COST_PER_IMAGE_USD, 10);
      expect(existsSync(segundo.path)).toBe(true);
    } finally {
      if (anterior === undefined) delete process.env['REBECA_FFMPEG'];
      else process.env['REBECA_FFMPEG'] = anterior;
      resetFfmpegAvailabilityCache();
    }
  });
});

describe('QA-016 achado ALTA — o livro registra a segunda cobrança', () => {
  it.skipIf(!HAS_FFMPEG)(
    'arquivo apagado entre execuções: o provedor cobra de novo e a cobrança ENTRA no livro',
    async () => {
      /*
       * O achado mais grave desta rodada, e é de dinheiro — reproduzido pelo QA contra a minha correção
       * do achado 6: com o ARQUIVO apagado e o livro intacto, o provedor é chamado outra vez e cobra
       * outra vez; a consulta ao livro achava a linha antiga e omitia a segunda cobrança. O episódio
       * seguia relatando o custo de UMA imagem depois de pagar duas.
       *
       * A regra corrigida: cobrou agora (`costUsd > 0`) ⇒ registra sempre. A consulta ao livro só vale
       * quando o provedor não cobrou (o arquivo já estava lá).
       */
      process.env['REBECA_MINIMAX_API_KEY'] = 'chave-de-teste-nao-real';
      const fetchMock = stubFetch(respostaOk());
      const { runSimulatedEpisode } = await import('../../../server/media/simulated-episode.js');

      const primeira = await runSimulatedEpisode(EPISODIO_DE_TESTE, {
        now: new Date('2026-10-02T12:00:00.000Z'),
        imageProvider: 'auto',
      });
      expect(fetchMock.mock.calls.length).toBe(2); // uma imagem por cena
      expect(linhasDeImagem()).toHaveLength(2);

      // Apaga SÓ os arquivos das imagens: manifesto e livro continuam dizendo que existem.
      const arquivos = primeira.assets.filter((asset) => asset.stage === 'imagem').map((asset) => asset.path);
      for (const arquivo of arquivos) rmSync(arquivo, { force: true });

      const segunda = await runSimulatedEpisode(EPISODIO_DE_TESTE, {
        now: new Date('2026-10-02T12:05:00.000Z'),
        imageProvider: 'auto',
      });

      // Duas imagens foram cobradas de novo...
      expect(fetchMock.mock.calls.length).toBe(4);
      // ...e as duas cobranças estão no livro: duas linhas por cena, e o custo do episódio dobrou.
      expect(linhasDeImagem()).toHaveLength(4);
      expect(segunda.cost.totalUsd).toBeCloseTo(4 * MINIMAX_COST_PER_IMAGE_USD, 10);
      // O relatório diz a verdade: o que foi cobrado agora é GERADO, não reusado.
      expect(segunda.assets.filter((asset) => asset.stage === 'imagem').every((asset) => !asset.reused)).toBe(true);
    },
    TIMEOUT,
  );
});

describe('QA-016 achado ALTA — o adapter da OpenAI (o caminho pago em uso)', () => {
  /*
   * A validação de integridade vivia dentro de `minimax.ts`, e foi por isso que o adapter da **OpenAI** —
   * que `providerForThumbnails` prefere quando há chave, e que o livro mostra em uso — ficou sem nenhuma
   * dela: gravava antes de validar e tratava `existsSync` como "ativo pronto". Estes testes vivem aqui, e
   * não só no arquivo do QA, para a garantia não depender de quem revisa.
   */
  const PEDIDO_THUMB: ThumbnailRequest = {
    channelId: 'luna',
    scopeChannelId: 'luna',
    episodeId: 'luna-ep-imagens',
    promptVersion: 'criar-thumbnail@v1',
    optionId: 'a',
    prompt: 'Luna no jardim, cores da paleta',
    textOnImage: 'LUNA E AS CORES',
    hypothesis: 'foco no personagem',
    width: 1280,
    height: 720,
    seed: 7,
  };

  it('a OpenAI grava só depois de validar: lixo do provedor não deixa ativo nem vira "sucesso grátis"', async () => {
    process.env['OPENAI_API_KEY'] = 'chave-de-teste-nao-real';
    try {
      const { openAiThumbnailProvider, planOpenAiThumbnail } = await import('../../../server/media/providers/openai.js');
      const lixo = Buffer.from('<!doctype html><html>erro do provedor</html>', 'utf8');
      const fetchMock = stubFetch({ data: [{ b64_json: lixo.toString('base64') }] });
      const path = planOpenAiThumbnail(PEDIDO_THUMB).path;

      await expect(openAiThumbnailProvider.generate(PEDIDO_THUMB)).rejects.toThrowError(/não é um PNG/);
      expect(existsSync(path)).toBe(false);
      expect(existsSync(`${path}.parcial`)).toBe(false);

      // Retentativa: volta à rede e falha de novo, em vez de servir o arquivo ruim com custo zero.
      fetchMock.mockClear();
      await expect(openAiThumbnailProvider.generate(PEDIDO_THUMB)).rejects.toThrowError(/não é um PNG/);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(existsSync(path)).toBe(false);
    } finally {
      delete process.env['OPENAI_API_KEY'];
    }
  });

  it('a OpenAI não trata arquivo de zero byte como ativo: regera e cobra', async () => {
    process.env['OPENAI_API_KEY'] = 'chave-de-teste-nao-real';
    try {
      const { openAiThumbnailProvider, planOpenAiThumbnail } = await import('../../../server/media/providers/openai.js');
      const path = planOpenAiThumbnail(PEDIDO_THUMB).path;
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, Buffer.alloc(0)); // o que uma escrita interrompida deixa

      const fetchMock = stubFetch({ data: [{ b64_json: PNG_DO_PROVEDOR.toString('base64') }] });
      const asset = await openAiThumbnailProvider.generate(PEDIDO_THUMB);

      expect(fetchMock).toHaveBeenCalledTimes(1); // regerou (e cobrou) em vez de reusar o vazio
      expect(asset.costUsd).toBeGreaterThan(0);
      expect(readFileSync(asset.path).length).toBe(PNG_DO_PROVEDOR.length);
      expect(pngSize(asset.path)).toEqual({ width: 1280, height: 720 });

      // E agora que o arquivo é uma imagem de verdade, a chamada seguinte reusa sem tocar a rede.
      fetchMock.mockClear();
      const segunda = await openAiThumbnailProvider.generate(PEDIDO_THUMB);
      expect(fetchMock).not.toHaveBeenCalled();
      expect(segunda.costUsd).toBe(0);
    } finally {
      delete process.env['OPENAI_API_KEY'];
    }
  });

  it('a OpenAI NÃO aceita JPEG: o ativo dela nasce com nome .png e o manifesto o declara PNG', async () => {
    process.env['OPENAI_API_KEY'] = 'chave-de-teste-nao-real';
    try {
      const { openAiThumbnailProvider, planOpenAiThumbnail } = await import('../../../server/media/providers/openai.js');
      // Cabeçalho JPEG válido (SOI + APP0/JFIF + EOI) — recusado de propósito no adapter da OpenAI.
      const jpeg = Buffer.from([
        0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00,
        0x00, 0xff, 0xd9,
      ]);
      stubFetch({ data: [{ b64_json: jpeg.toString('base64') }] });
      const path = planOpenAiThumbnail(PEDIDO_THUMB).path;

      await expect(openAiThumbnailProvider.generate(PEDIDO_THUMB)).rejects.toThrowError(/não é um PNG/);
      expect(existsSync(path)).toBe(false);
    } finally {
      delete process.env['OPENAI_API_KEY'];
    }
  });
});

describe('QA-015 achado 6 — o livro não depende do manifesto', () => {
  it.skipIf(!HAS_FFMPEG)(
    'apagado o `meta.json`, a reexecução NÃO relança linha no livro e conta o ativo como reusado',
    async () => {
      /*
       * Achado nº 4 do `QA-010` (pendência antiga) e achado 6 do `QA-015`: com o manifesto perdido e os
       * arquivos no disco, o provedor não gastava (o arquivo segurava o dinheiro) mas o livro ganhava linha
       * nova e o relatório dizia "gerado de novo" onde nada foi gerado. Aqui as duas metades são medidas:
       * nenhuma requisição nova, nenhuma linha nova, nada de arquivo novo — e o custo REAL volta para o
       * manifesto reconstruído, lido do livro, em vez de virar zero.
       */
      process.env['REBECA_MINIMAX_API_KEY'] = 'chave-de-teste-nao-real';
      const fetchMock = stubFetch(respostaOk());
      const { runSimulatedEpisode } = await import('../../../server/media/simulated-episode.js');

      const primeira = await runSimulatedEpisode(EPISODIO_DE_TESTE, {
        now: new Date('2026-10-02T12:00:00.000Z'),
        imageProvider: 'auto',
      });
      const linhas = ledgerRowCount();
      const arquivos = arquivosGerados();
      const chamadas = fetchMock.mock.calls.length;
      expect(primeira.assets.filter((asset) => asset.stage === 'imagem').every((a) => a.costUsd > 0)).toBe(true);

      const manifesto = join(tempDir, 'assets', 'luna', 'luna-ep-imagens', 'meta.json');
      rmSync(manifesto, { force: true });
      expect(existsSync(manifesto)).toBe(false);

      const segunda = await runSimulatedEpisode(EPISODIO_DE_TESTE, {
        now: new Date('2026-10-02T12:05:00.000Z'),
        imageProvider: 'auto',
      });

      // As três provas: sem requisição nova, sem linha nova, sem arquivo novo.
      expect(fetchMock.mock.calls.length).toBe(chamadas);
      expect(ledgerRowCount()).toBe(linhas);
      expect(arquivosGerados()).toEqual(arquivos);
      // E o relatório diz a verdade: nada foi gerado, tudo foi reusado.
      expect(segunda.created).toBe(0);
      expect(segunda.reused).toBe(primeira.created);
      // O manifesto reconstruído mantém o custo que o LIVRO registra — não o zero que o provedor devolveu.
      const imagens = segunda.assets.filter((asset) => asset.stage === 'imagem');
      expect(imagens).toHaveLength(2);
      expect(imagens.every((asset) => asset.reused)).toBe(true);
      expect(imagens.every((asset) => asset.costUsd === MINIMAX_COST_PER_IMAGE_USD)).toBe(true);
      expect(segunda.cost.totalUsd).toBeCloseTo(primeira.cost.totalUsd, 10);
    },
    TIMEOUT,
  );
});
