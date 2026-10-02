/**
 * QA-015 — refutação independente da **Fase 2** (o provedor de imagem real).
 *
 * Escrito pelo `rebeca-qa`. Nenhuma correção: cada teste abaixo tenta derrubar uma garantia declarada
 * pela entrega, e o comentário diz se conseguiu.
 *
 * ## Revisão de 2026-10-02 (autor das correções, autorizado pelo orquestrador)
 *
 * Os achados de mídia foram corrigidos. Os testes que **afirmavam o comportamento defeituoso**
 * (`REFUTADO:`) não tinham estado em que eles e a correção fossem verdadeiros ao mesmo tempo — e teste
 * vermelho permanente treina o time a ignorar vermelho. Cada um foi **invertido para afirmar a garantia**,
 * com a asserção antiga preservada como comentário logo acima (o valor documental do que foi refutado não
 * se perde). Três testes que apenas usavam um fixture falso (`pngMinimo`, 33 bytes — exatamente o arquivo
 * que a validação nova recusa) passaram a usar `pngSolido`, que já existia neste arquivo. **Nenhuma
 * asserção foi afrouxada:** toda inversão é mais estrita que a original.
 *
 * Os `REFUTADO:` que continuam com esse título são os que **não** foram corrigidos (não há correção para
 * inverter) — nenhum, hoje, nos achados de mídia.
 *
 * Alvos indicados pelo próprio autor:
 *   1. `imageProvider: 'auto'` com chave presente e ausente — o que a resposta diz em cada caso;
 *   2. a resolução: manda `aspect_ratio: 16:9` e MEDE o arquivo — a afirmação bate com o código?
 *   3. `planImageFor` com um **terceiro** provedor (o autor só testou simulado e MiniMax);
 *   4. idempotência: rodar duas vezes não gera arquivo novo nem linha nova no livro;
 *   5. o portão de allow-list antes de qualquer chamada de rede.
 *
 * Tudo em `REBECA_ROOT` / `REBECA_ASSETS_ROOT` / `REBECA_COST_LEDGER` temporários (D9: a árvore real
 * tem outro escritor).
 */

import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { deflateSync } from 'node:zlib';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AssetPlan, GeneratedAsset, ImageProvider, ImageRequest } from '../contract.js';
import { resetMemoryLedger } from '../../../server/ai/ledger.js';
import { ledgerRowCount } from '../../../server/media/ledger.js';
import { assetPath, ChannelScopeError } from '../../../server/media/paths.js';
import {
  declaredUnitPriceUsd,
  imageProviderNotice,
  planImageFor,
  pngSize,
  resolveImageProvider,
} from '../../../server/media/providers/image-provider.js';
import {
  miniMaxImageProvider,
  miniMaxAspectRatioFor,
  planMiniMaxImage,
} from '../../../server/media/providers/minimax.js';
import { planImage, SIMULATED_MODELS, simulatedImageProvider } from '../../../server/media/providers/simulated.js';
import { ffmpegAvailable } from '../../../server/media/ffmpeg.js';
import type { EpisodeSpec } from '../../../server/media/simulated-episode.js';

const HAS_FFMPEG = ffmpegAvailable();
const TIMEOUT = 300_000;

let tempDir = '';

const PEDIDO: ImageRequest = {
  channelId: 'luna',
  scopeChannelId: 'luna',
  episodeId: 'luna-ep-qa',
  promptVersion: 'criar-cena@v1',
  sceneId: 'cena-01',
  prompt: 'Referência sintética: personagem pequena em um jardim claro, formas suaves.',
  onScreenText: 'Cena 1 — teste',
  width: 1920,
  height: 1080,
  seed: 101,
};

/** Episódio de uma cena: o que está sob teste é o caminho da imagem, não o volume. */
const EPISODIO_CURTO: EpisodeSpec = {
  channelId: 'luna',
  channelName: 'Luna e o Jardim das Cores',
  episodeId: 'luna-ep-qa',
  slug: 'luna-ep-qa',
  title: 'Episódio do QA (referência sintética)',
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
  ],
};

/* =============================================================================
   PNG mínimo e legível por `pngSize`
   ============================================================================= */
/** PNG com assinatura + IHDR válido (é o suficiente para `pngSize` e `assertImageBytes`). */
function pngMinimo(width: number, height: number): Buffer {
  const cabecalho = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(cabecalho, 0);
  cabecalho.writeUInt32BE(13, 8);
  cabecalho.write('IHDR', 12, 'latin1');
  cabecalho.writeUInt32BE(width, 16);
  cabecalho.writeUInt32BE(height, 20);
  cabecalho[24] = 8;
  cabecalho[25] = 2;
  return cabecalho;
}

/*
 * PNG **decodificável** (IHDR + IDAT + IEND, com CRC) — necessário para os testes que rodam o pipeline
 * inteiro. A lição veio de um teste deste próprio arquivo que travou 15 minutos: `pngMinimo` passa no
 * `assertImageBytes` (3 bytes de assinatura) mas **não é decodificável**, e o ffmpeg do passo do clipe
 * queima CPU e memória sem terminar. O teste do autor já avisava disso; aqui está a consequência medida.
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
  ihdr[8] = 8;
  ihdr[9] = 2;
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

/**
 * PNG com o `IHDR` sob medida e o fluxo de pixels que o teste quiser — **estruturalmente íntegro** (CRCs
 * corretos, `IDAT` que descomprime, `IEND` presente) e semanticamente errado. É o instrumento do QA-016
 * para separar a camada 1 (estrutura) da camada 2 (decodificação real).
 */
function pngEstrutural(input: {
  readonly width: number;
  readonly height: number;
  readonly bitDepth?: number;
  readonly colorType?: number;
  readonly interlace?: number;
  readonly pixelsCrus: Buffer;
}): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(input.width, 0);
  ihdr.writeUInt32BE(input.height, 4);
  ihdr[8] = input.bitDepth ?? 8;
  ihdr[9] = input.colorType ?? 2;
  ihdr[12] = input.interlace ?? 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(input.pixelsCrus)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function stubFetch(corpo: unknown, status = 200) {
  const mock = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify(corpo), { status }));
  vi.stubGlobal('fetch', mock);
  return mock;
}

/** Resposta de sucesso no formato documentado, com a imagem em base64. */
function respostaOk(png: Buffer): Record<string, unknown> {
  return {
    id: 'trace-qa',
    data: { image_base64: [png.toString('base64')] },
    metadata: { success_count: 1, failed_count: 0 },
    base_resp: { status_code: 0, status_msg: 'success' },
  };
}

function arquivosGerados(): string[] {
  const raiz = join(tempDir, 'assets');
  if (!existsSync(raiz)) return [];
  return readdirSync(raiz, { recursive: true, encoding: 'utf8' }).map((item) => item.replaceAll('\\', '/')).sort();
}

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'rebeca-qa-imagens-'));
  process.env['REBECA_ROOT'] = tempDir;
  process.env['REBECA_COST_LEDGER'] = join(tempDir, 'custos.csv');
  process.env['REBECA_ASSETS_ROOT'] = join(tempDir, 'assets');
  process.env['REBECA_MINIMAX_API_KEY'] = 'chave-de-teste-nao-real';
  // Allow-list que permite tudo o que estes testes usam — inclusive o fornecedor simulado.
  const path = join(tempDir, '.rebeca', 'canais', 'luna', 'allow-list.json');
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(
    path,
    JSON.stringify({
      canal: 'luna',
      nome: 'Luna',
      publico: 'infantil',
      atualizadoEm: '2026-10-02',
      fonte: 'teste do QA',
      regra: 'teste do QA',
      entradas: [
        { fornecedor: 'minimax', modelo: 'image-01', finalidade: 'imagem', status: 'PERMITIDO', fundamento: 't', fonteUrl: 'https://exemplo.invalido', lidoEm: '2026-10-02', aprovadoPor: 'humano:teste', aprovadoEm: '2026-10-02' },
        { fornecedor: 'simulado-imagem', modelo: SIMULATED_MODELS.image, finalidade: 'imagem', status: 'PERMITIDO', fundamento: 't', fonteUrl: 'https://exemplo.invalido', lidoEm: '2026-10-02', aprovadoPor: 'humano:teste', aprovadoEm: '2026-10-02' },
        { fornecedor: 'simulado-animacao', modelo: SIMULATED_MODELS.video, finalidade: 'animacao', status: 'PERMITIDO', fundamento: 't', fonteUrl: 'https://exemplo.invalido', lidoEm: '2026-10-02', aprovadoPor: 'humano:teste', aprovadoEm: '2026-10-02' },
        { fornecedor: 'simulado-voz', modelo: SIMULATED_MODELS.tts, finalidade: 'voz', status: 'PERMITIDO', fundamento: 't', fonteUrl: 'https://exemplo.invalido', lidoEm: '2026-10-02', aprovadoPor: 'humano:teste', aprovadoEm: '2026-10-02' },
        { fornecedor: 'simulado-musica', modelo: SIMULATED_MODELS.music, finalidade: 'musica', status: 'PERMITIDO', fundamento: 't', fonteUrl: 'https://exemplo.invalido', lidoEm: '2026-10-02', aprovadoPor: 'humano:teste', aprovadoEm: '2026-10-02' },
      ],
    }),
    'utf8',
  );
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

/* =============================================================================
   1. A resolução: o que o código envia × o que ele mede
   ============================================================================= */

describe('QA Fase 2 — resolução: o que é pedido, o que é enviado e o que é medido', () => {
  it('o pedido 1920x1080 vira `aspect_ratio: 16:9` — e `width`/`height` NÃO vão no corpo', async () => {
    expect(miniMaxAspectRatioFor(1920, 1080)).toBe('16:9');
    // Fixture trocada em 2026-10-02: era `pngMinimo` (33 bytes, sem IDAT) — o arquivo que a validação nova
    // e correta passou a recusar. `pngSolido` é um PNG de verdade e o teste mede o que sempre quis medir.
    const fetchMock = stubFetch(respostaOk(pngSolido(1280, 720, [30, 41, 59])));

    await miniMaxImageProvider.render(PEDIDO);

    const corpo = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as Record<string, unknown>;
    expect(corpo['aspect_ratio']).toBe('16:9');
    // CONFIRMADO: a decisão declarada no comentário (`aspect_ratio` tem prioridade, então width/height
    // não são enviados) é o que o código faz — não há campo `width`/`height` no corpo.
    expect(corpo['width']).toBeUndefined();
    expect(corpo['height']).toBeUndefined();
  });

  it('CONFIRMADO: a resolução publicada é MEDIDA do arquivo, não repetida do pedido', async () => {
    // O provedor devolve 640x360 (16:9, mas longe dos 1920x1080 pedidos) — a medição tem de acusar isso.
    // Fixture trocada em 2026-10-02 (`pngMinimo` → `pngSolido`, ver nota no topo do arquivo).
    stubFetch(respostaOk(pngSolido(640, 360, [30, 41, 59])));

    const asset = await miniMaxImageProvider.render(PEDIDO);

    expect(pngSize(asset.path)).toEqual({ width: 640, height: 360 });
    // E o `EpisodeAssetView` do pipeline mede o mesmo arquivo (não há caminho que copie o pedido).
    expect(pngSize(asset.path)).not.toEqual({ width: PEDIDO.width, height: PEDIDO.height });
  });

  it('tenta enganar a medição com um PNG sem IHDR (arquivo truncado)', () => {
    const soAssinatura = pngMinimo(1280, 720).subarray(0, 12);
    const path = join(tempDir, 'truncado.png');
    writeFileSync(path, soAssinatura);
    // CONFIRMADO: sem IHDR legível a medição devolve `null` ("não medido"), não zero nem o pedido.
    expect(pngSize(path)).toBeNull();
  });
});

/* =============================================================================
   2. Idempotência — e o que acontece quando a validação falha DEPOIS de gravar
   ============================================================================= */

describe('QA Fase 2 — idempotência e integridade do arquivo', () => {
  it('idempotência normal: duas chamadas, uma única requisição, custo zero na segunda', async () => {
    // Fixture trocada em 2026-10-02 (`pngMinimo` → `pngSolido`): idempotência de um arquivo que não abre
    // não prova idempotência de nada. O que se quer medir aqui é a segunda chamada reusar a arte REAL.
    const fetchMock = stubFetch(respostaOk(pngSolido(1280, 720, [30, 41, 59])));

    const primeira = await miniMaxImageProvider.render(PEDIDO);
    const segunda = await miniMaxImageProvider.render(PEDIDO);

    expect(segunda.path).toBe(primeira.path);
    expect(segunda.costUsd).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  /*
   * INVERTIDO em 2026-10-02 (achado 1 do QA-015, gravidade ALTA) — mesmo teste, agora afirmando a
   * garantia. Reprodução mínima do defeito que ele media, preservada:
   *
   *   const path = planMiniMaxImage(PEDIDO).path;
   *   await expect(miniMaxImageProvider.render(PEDIDO)).rejects.toThrowError(/não é uma imagem/);
   *   expect(existsSync(path)).toBe(true);                                  // ← o lixo FICAVA no disco
   *   expect(readFileSync(path).toString('utf8')).toContain('erro do provedor');
   *   fetchMock.mockClear();
   *   const segunda = await miniMaxImageProvider.render(PEDIDO);
   *   expect(fetchMock).not.toHaveBeenCalled();                             // ← nem tocava a rede
   *   expect(segunda.costUsd).toBe(0);                                      // ← "sucesso grátis"
   *   expect(segunda.path).toBe(path);
   *
   * Causa: `writeFileSync` rodava ANTES de `assertImageBytes`, e `fileExists` só olhava tamanho > 0 — a
   * falha detectada virava ativo "pronto" na retentativa. A inversão é MAIS ESTRITA que o original: além
   * de negar o arquivo, exige que a segunda chamada volte à rede e falhe de novo.
   */
  it('CORRIGIDO (QA-015, achado 1, 2026-10-02): resposta que não é imagem não deixa arquivo no disco nem vira "sucesso grátis"', async () => {
    // O provedor responde `base_resp.status_code: 0` com bytes que NÃO são PNG/JPEG (ex.: página de erro
    // ou texto codificado em base64 pela borda).
    const lixo = Buffer.from('<!doctype html><html>erro do provedor</html>', 'utf8');
    const fetchMock = stubFetch(respostaOk(lixo));
    const path = planMiniMaxImage(PEDIDO).path;

    // 1) A primeira chamada falha — como prometido.
    await expect(miniMaxImageProvider.render(PEDIDO)).rejects.toThrowError(/não é uma imagem/);

    // 2) E NADA fica no disco: nem o destino, nem o arquivo de passagem da gravação validada.
    expect(existsSync(path)).toBe(false);
    expect(existsSync(`${path}.parcial`)).toBe(false);

    // 3) A segunda chamada NÃO pode considerar a idempotência satisfeita: sem ativo, ela volta à rede e
    //    falha de novo — em vez de devolver sucesso com custo zero sobre um arquivo que não é imagem.
    fetchMock.mockClear();
    await expect(miniMaxImageProvider.render(PEDIDO)).rejects.toThrowError(/não é uma imagem/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(existsSync(path)).toBe(false);
  });

  /*
   * INVERTIDO em 2026-10-02 (achados 1 e 8 do QA-015) — mesmo teste, agora afirmando a garantia.
   * Reprodução mínima do defeito que ele media, preservada:
   *
   *   writeFileSync(path, pngMinimo(1280, 720).subarray(0, 20));   // assinatura + IHDR parcial
   *   const asset = await miniMaxImageProvider.render(PEDIDO);
   *   expect(fetchMock).not.toHaveBeenCalled();   // ← aceitava o truncado como ativo pronto
   *   expect(asset.costUsd).toBe(0);              // ← e cobrava zero por ele
   *   expect(pngSize(asset.path)).toBeNull();     // ← nem resolução o arquivo entregava
   *
   * Causa: `fileExists` só olhava tamanho. A inversão é MAIS ESTRITA: exige requisição nova, custo real
   * e um arquivo que agora entrega resolução.
   */
  it('CORRIGIDO (QA-015, achados 1 e 8, 2026-10-02): arquivo truncado por outro processo é regerado, não reusado', async () => {
    const path = planMiniMaxImage(PEDIDO).path;
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, pngMinimo(1280, 720).subarray(0, 20)); // assinatura + IHDR parcial
    const fetchMock = stubFetch(respostaOk(pngSolido(1280, 720, [30, 41, 59])));

    const asset = await miniMaxImageProvider.render(PEDIDO);

    // O truncado não conta como ativo: o provedor é chamado de novo e a imagem inteira é que fica.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(asset.costUsd).toBeCloseTo(0.0035, 10);
    expect(pngSize(asset.path)).toEqual({ width: 1280, height: 720 });
    expect(readFileSync(asset.path).length).toBeGreaterThan(20);
  });
});

/* =============================================================================
   2b. Idempotência no nível do PIPELINE (arquivo × manifesto × livro)
   ============================================================================= */

describe('QA Fase 2 — idempotência do episódio quando o manifesto se perde', () => {
  /*
   * INVERTIDO em 2026-10-02 (achado 6 do QA-015 / achado nº 4 do QA-010) — mesmo teste, agora afirmando a
   * garantia. Reprodução mínima do defeito que ele media, preservada:
   *
   *   rmSync(manifesto, { force: true });                       // só o meta.json sai; arquivos ficam
   *   const segunda = await runSimulatedEpisode(EPISODIO_CURTO, { imageProvider: 'auto' });
   *   expect(fetchMock.mock.calls.length).toBe(chamadasPrimeira);   // ✔ nenhuma requisição nova
   *   expect(segunda.created).toBe(primeira.created);               // ← dizia "gerado de novo"
   *   expect(segunda.reused).toBe(0);                               // ← nada reusado
   *   expect(ledgerRowCount()).toBeGreaterThan(linhasPrimeira);     // ← LIVRO RELANÇADO
   *
   * Causa: a idempotência se apoiava só no manifesto. O provedor não gastava (o arquivo segurava o
   * dinheiro), mas o livro ganhava linha nova a cada reexecução e o relatório dizia "gerado" onde nada
   * foi gerado. A inversão é MAIS ESTRITA: além de negar as linhas novas, exige `created = 0`,
   * `reused = total` e que o custo REAL volte ao manifesto reconstruído.
   */
  it.skipIf(!HAS_FFMPEG)(
    'CORRIGIDO (QA-015, achado 6, 2026-10-02): sem o `meta.json`, a reexecução NÃO relança linhas no livro',
    async () => {
      /*
       * Este é o achado nº 4 do `QA-010`, registrado lá como **pendência da Fase 1**: "perdido o
       * manifesto com os ativos no disco, o pipeline re-registra custo sem regerar". A Fase 2 promete
       * que a idempotência "não se apoia só no manifesto: a prova é o arquivo existir". O teste mede
       * as duas metades dessa promessa.
       */
      const { runSimulatedEpisode } = await import('../../../server/media/simulated-episode.js');
      const fetchMock = stubFetch(respostaOk(pngSolido(1280, 720, [30, 41, 59])));

      const primeira = await runSimulatedEpisode(EPISODIO_CURTO, {
        now: new Date('2026-10-02T12:00:00.000Z'),
        imageProvider: 'auto',
      });
      const linhasPrimeira = ledgerRowCount();
      const chamadasPrimeira = fetchMock.mock.calls.length;
      expect(chamadasPrimeira).toBe(1);

      // Apaga SÓ o manifesto: os arquivos continuam no disco.
      const manifesto = join(tempDir, 'assets', 'luna', 'luna-ep-qa', 'meta.json');
      rmSync(manifesto, { force: true });
      expect(existsSync(manifesto)).toBe(false);

      const segunda = await runSimulatedEpisode(EPISODIO_CURTO, {
        now: new Date('2026-10-02T12:05:00.000Z'),
        imageProvider: 'auto',
      });

      // Metade 1: NENHUMA requisição nova — o arquivo em disco segura o gasto.
      expect(fetchMock.mock.calls.length).toBe(chamadasPrimeira);
      // Metade 2 (a que não se sustentava): o livro NÃO cresce. O pipeline consulta o livro pelo
      // `(episódio, etapa, modelo, hash8)` antes de registrar de novo.
      expect(ledgerRowCount()).toBe(linhasPrimeira);
      expect(segunda.created).toBe(0);
      expect(segunda.reused).toBe(primeira.created);
      // E o manifesto reconstruído recebe o custo que o LIVRO registra — não o `0` que o provedor
      // devolveu ao encontrar o arquivo pronto. Sem isto, "quanto custou este episódio" perderia o valor.
      const imagens = segunda.assets.filter((asset) => asset.stage === 'imagem');
      expect(imagens).toHaveLength(1);
      expect(imagens.every((asset) => asset.reused)).toBe(true);
      expect(imagens.every((asset) => asset.costUsd === 0.0035)).toBe(true);
    },
    TIMEOUT,
  );
});

/* =============================================================================
   3. `planImageFor` com um TERCEIRO provedor
   ============================================================================= */

describe('QA Fase 2 — planImageFor com um terceiro provedor', () => {
  it('terceiro provedor REAL que declara `plan` é respeitado', () => {
    /*
     * Fixture corrigida em 2026-10-02 (achado 5 do QA-015): o caminho era `join(tempDir, 'x.png')`, FORA
     * da pasta do canal — ou seja, este teste exigia que um plano fora do escopo fosse aceito, contra o
     * achado 5 escrito pelo próprio QA. Agora o plano é um ativo legítimo do canal.
     */
    const proprio: AssetPlan = {
      hash: 'deadbeef',
      sha256: 'f'.repeat(64),
      path: assetPath({
        scopeChannelId: 'luna',
        channelId: 'luna',
        episodeId: PEDIDO.episodeId,
        stage: 'imagem',
        slug: 'cena-01',
        hash8: 'deadbeef',
        ext: 'png',
      }),
    };
    const terceiro: ImageProvider & { plan: (input: ImageRequest) => AssetPlan } = {
      id: 'terceiro-real',
      model: 'modelo-z',
      simulated: false,
      plan: () => proprio,
      render: (): Promise<GeneratedAsset> => Promise.reject(new Error('não usado')),
    };

    expect(planImageFor(terceiro, PEDIDO)).toEqual(proprio);
  });

  it('terceiro provedor REAL sem `plan` é recusado (garantia que resistiu)', () => {
    const semPlano: ImageProvider = {
      id: 'terceiro-sem-plan',
      model: 'modelo-z',
      simulated: false,
      render: (): Promise<GeneratedAsset> => Promise.reject(new Error('não usado')),
    };
    expect(() => planImageFor(semPlano, PEDIDO)).toThrowError(/não declara `plan\(\)`/);
  });

  /*
   * INVERTIDO em 2026-10-02 (achado 4 do QA-015) — mesmo teste, agora afirmando a garantia. Reprodução
   * mínima do defeito que ele media, preservada:
   *
   *   const doFfmpeg = planImageFor(simulatedImageProvider, PEDIDO);
   *   const doOutro = planImageFor(outroSimulado, PEDIDO);   // simulado: true, sem `plan`
   *   expect(planImage(PEDIDO)).toEqual(doFfmpeg);           // controle
   *   expect(doOutro.path).toBe(doFfmpeg.path);              // ← MESMO arquivo do ffmpeg
   *   expect(doOutro.hash).toBe(doFfmpeg.hash);              // ← MESMO hash
   *   expect(doOutro.sha256).toBe(doFfmpeg.sha256);
   *
   * Causa: o ramo de fallback era `if (provider.simulated) return planImage(input)` — chaveado pela flag,
   * não pela identidade. Um segundo gerador local escreveria no arquivo do primeiro. A inversão é MAIS
   * ESTRITA: exige a recusa e mantém o controle de que o simulado de verdade não mudou.
   */
  it('CORRIGIDO (QA-015, achado 4, 2026-10-02): terceiro provedor SIMULADO sem `plan` NÃO herda o caminho do ffmpeg', () => {
    const outroSimulado: ImageProvider = {
      id: 'simulado-outro-gerador',
      model: 'outro-gerador-1',
      simulated: true,
      render: (): Promise<GeneratedAsset> => Promise.reject(new Error('não usado')),
    };

    // Controle: o simulado de verdade continua com o plano canônico dele.
    expect(planImageFor(simulatedImageProvider, PEDIDO)).toEqual(planImage(PEDIDO));
    // E o outro é recusado — declarar `simulated: true` não empresta hash nem caminho de ninguém.
    expect(() => planImageFor(outroSimulado, PEDIDO)).toThrowError(/não empresta o caminho de ninguém/);
  });

  /*
   * INVERTIDO em 2026-10-02 (achado 5 do QA-015) — mesmo teste, agora afirmando a garantia. Reprodução
   * mínima do defeito que ele media, preservada:
   *
   *   const foraDoCanal = join(tempDir, 'fora', 'canal-alheio.png');
   *   const plano = planImageFor(terceiro, PEDIDO);
   *   expect(plano.path).toBe(foraDoCanal);                 // ← aceitava ativo fora do canal
   *   expect(plano.path).not.toContain(join('assets', 'luna'));
   *
   * Causa: `assertWithinChannel` só rodava dentro de `assetPath`, isto é, só nos planos do simulado e da
   * MiniMax. A inversão é MAIS ESTRITA: exige a exceção de escopo (classe e mensagem) e acrescenta o
   * lado oposto — um plano legítimo, dentro do canal, continua sendo respeitado.
   */
  it('CORRIGIDO (QA-015, achado 5, 2026-10-02): o `plan` de terceiro fora do canal é recusado; dentro, é respeitado', () => {
    const terceiroCom = (caminho: string): ImageProvider & { plan: (input: ImageRequest) => AssetPlan } => ({
      id: 'terceiro-real',
      model: 'modelo-z',
      simulated: false,
      plan: () => ({ hash: 'deadbeef', sha256: 'f'.repeat(64), path: caminho }),
      render: (): Promise<GeneratedAsset> => Promise.reject(new Error('não usado')),
    });

    const foraDoCanal = join(tempDir, 'fora', 'canal-alheio.png');
    expect(() => planImageFor(terceiroCom(foraDoCanal), PEDIDO)).toThrowError(ChannelScopeError);
    expect(() => planImageFor(terceiroCom(foraDoCanal), PEDIDO)).toThrowError(/fora da pasta do canal/);

    // O ponto de extensão não virou parede: dentro do canal, o plano do provedor vale.
    const dentroDoCanal = assetPath({
      scopeChannelId: 'luna',
      channelId: 'luna',
      episodeId: PEDIDO.episodeId,
      stage: 'imagem',
      slug: 'cena-01',
      hash8: 'deadbeef',
      ext: 'png',
    });
    expect(planImageFor(terceiroCom(dentroDoCanal), PEDIDO).path).toBe(dentroDoCanal);
  });

  it('terceiro provedor real pago sem preço declarado: o aviso e a estimativa não inventam número', () => {
    const pagoSemPreco: ImageProvider = {
      id: 'terceiro-pago',
      model: 'modelo-z',
      simulated: false,
      render: (): Promise<GeneratedAsset> => Promise.reject(new Error('não usado')),
    };
    expect(declaredUnitPriceUsd(pagoSemPreco)).toBeNull();
    expect(imageProviderNotice(pagoSemPreco).costPerImageUsd).toBeNull();
    expect(imageProviderNotice(pagoSemPreco).deepSynthesis.required).toBe(false);
    expect(imageProviderNotice(pagoSemPreco).motivo).toMatch(/NÃO VERIFICADOS/);
  });
});

/* =============================================================================
   4. `imageProvider: 'auto'` — com e sem chave
   ============================================================================= */

describe("QA Fase 2 — o caminho imageProvider: 'auto'", () => {
  it('sem chave: resolve o simulado e a RESPOSTA diz que é prova de máquina', () => {
    delete process.env['REBECA_MINIMAX_API_KEY'];
    const escolha = resolveImageProvider();
    expect(escolha.provider.id).toBe('simulado-imagem');
    expect(escolha.notice.simulated).toBe(true);
    expect(escolha.notice.motivo).toMatch(/Prova de máquina, NÃO arte/);
    expect(escolha.origem).toMatch(/Não há chave da MiniMax/);
  });

  it('com chave: resolve a MiniMax e o aviso carrega preço, 720p e o rótulo NÃO VERIFICADO', () => {
    const escolha = resolveImageProvider();
    expect(escolha.provider.id).toBe('minimax');
    expect(escolha.notice.simulated).toBe(false);
    expect(escolha.notice.costPerImageUsd).toBeCloseTo(0.0035, 10);
    expect(escolha.notice.motivo).toMatch(/1280x720/);
    expect(escolha.notice.deepSynthesis.required).toBe(true);
    expect(escolha.notice.deepSynthesis.text).toBeNull();
  });

  it.skipIf(!HAS_FFMPEG)('um `providers` informado pelo chamador tem PRECEDÊNCIA sobre `auto`', async () => {
    /*
     * Comportamento DOCUMENTADO em `providersForEpisode`: `providers` vence `imageProvider: 'auto'`.
     * O teste prova que a chave presente + `auto` NÃO gera arte paga quando o chamador passou o
     * conjunto simulado — ou seja, o opt-in de gasto pode ser anulado por um parâmetro que não fala
     * de dinheiro. Precisa de ffmpeg (roda o episódio sintético inteiro).
     */
    const { runSimulatedEpisode } = await import('../../../server/media/simulated-episode.js');
    const { SIMULATED_PROVIDERS } = await import('../../../server/media/providers/simulated.js');
    const fetchMock = stubFetch(respostaOk(pngMinimo(1280, 720)));

    const resultado = await runSimulatedEpisode(EPISODIO_CURTO, {
      now: new Date('2026-10-02T12:00:00.000Z'),
      imageProvider: 'auto',
      providers: SIMULATED_PROVIDERS,
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(resultado.imageProvider.providerId).toBe('simulado-imagem');
    expect(resultado.cost.totalUsd).toBe(0);
  }, TIMEOUT);
});

/* =============================================================================
   5. O portão vem antes da rede — inclusive para um provedor INJETADO
   ============================================================================= */

describe('QA Fase 2 — o portão de fornecedor antes de qualquer rede', () => {
  it('fornecedor injetado fora da allow-list é recusado sem nenhuma chamada de rede', async () => {
    const { runSimulatedEpisode } = await import('../../../server/media/simulated-episode.js');
    const { ProviderNotAllowedError } = await import('../../../server/media/allow-list.js');
    const { SIMULATED_PROVIDERS } = await import('../../../server/media/providers/simulated.js');

    const render = vi.fn(async () => {
      throw new Error('o provedor NÃO pode ser chamado: o portão tem de recusar antes');
    });
    const intruso: ImageProvider = { id: 'fornecedor-intruso', model: 'm-1', simulated: false, render };

    const linhasAntes = ledgerRowCount();
    let capturado: unknown = null;
    try {
      await runSimulatedEpisode(EPISODIO_CURTO, {
        providers: { ...SIMULATED_PROVIDERS, image: intruso },
        estimateUsd: 1,
      });
    } catch (error) {
      capturado = error;
    }

    // CONFIRMADO: o portão roda para o provedor injetado também, e ANTES do `assertFfmpegAvailable`.
    // O teste roda sem depender de ffmpeg: se o portão viesse depois, o erro seria outro.
    expect(capturado).toBeInstanceOf(ProviderNotAllowedError);
    expect(String((capturado as Error).message)).toContain('fornecedor-intruso');
    expect(render).not.toHaveBeenCalled();
    expect(ledgerRowCount()).toBe(linhasAntes);
    expect(arquivosGerados()).toEqual([]);
  });

  it.skipIf(!HAS_FFMPEG)('provedor pago SEM preço declarado não gera: o portão de estimativa barra antes', async () => {
    const { runSimulatedEpisode } = await import('../../../server/media/simulated-episode.js');
    const { MediaBudgetError } = await import('../../../src/media/limits.js');
    const { SIMULATED_PROVIDERS } = await import('../../../server/media/providers/simulated.js');

    const pagoSemPreco: ImageProvider = {
      id: 'simulado-imagem', // id permitido na allow-list: o que barra é a estimativa, não a política
      model: SIMULATED_MODELS.image,
      simulated: false,
      render: vi.fn(async (): Promise<GeneratedAsset> => {
        throw new Error('não pode gerar');
      }),
    };

    let capturado: unknown = null;
    try {
      await runSimulatedEpisode(EPISODIO_CURTO, { providers: { ...SIMULATED_PROVIDERS, image: pagoSemPreco } });
    } catch (error) {
      capturado = error;
    }

    expect(capturado).toBeInstanceOf(MediaBudgetError);
    expect(String((capturado as Error).message)).toMatch(/estimativa/i);
    expect(pagoSemPreco.render).not.toHaveBeenCalled();
    expect(arquivosGerados()).toEqual([]);
  });
});

/* =============================================================================
   QA-016 — achados da SEGUNDA rodada (correções dos achados 1, 4, 5, 6, 7 e 8)
   ============================================================================= */

/*
 * Revisão de 2026-10-02 (autor das correções, autorizado pelo orquestrador): os quatro achados de mídia
 * desta rodada foram corrigidos — o do livro era de dinheiro. Os testes abaixo foram **invertidos** para
 * afirmar a garantia, com a reprodução mínima do defeito preservada como comentário em cada um e nenhuma
 * asserção afrouxada (as inversões são mais estritas que os originais).
 *
 * Os dois últimos (adapter da OpenAI) **não** foram invertidos: são de código fora do escopo desta
 * correção (`server/media/providers/openai.ts`), continuam valendo e seguem vermelhos de propósito, à
 * espera do dono daquele adapter.
 */
describe('QA-016 — o que a correção da Fase 2 ainda não cobre', () => {
  /*
   * INVERTIDO em 2026-10-02 (achado NOVO do QA-016, gravidade ALTA — dinheiro).
   * Reprodução mínima do defeito que ele media, preservada:
   *
   *   // 1 imagem paga, 1 linha no livro; depois `rmSync(arquivo)`
   *   const segunda = await runSimulatedEpisode(EPISODIO_CURTO, { imageProvider: 'auto' });
   *   expect(fetchMock.mock.calls.length).toBe(2);      // ✔ duas cobranças
   *   expect(linhasDeImagem()).toHaveLength(1);         // ← o livro continuava com UMA linha
   *   expect(segunda.cost.totalUsd).toBeCloseTo(0.0035, 10);  // ← custo pela metade
   *   expect(segunda.reused).toBeGreaterThan(0);        // ← e dizia "reusado"
   *
   * Causa: a correção do achado 6 consultava o livro e, achando linha, nunca registrava de novo — mas
   * esse caminho é alcançado exatamente quando o provedor **acabou de cobrar**. A inversão é MAIS
   * ESTRITA: exige as duas linhas, o custo dobrado e o ativo contado como gerado.
   */
  it('CORRIGIDO (QA-016, achado ALTA, 2026-10-02): arquivo apagado entre execuções — a segunda cobrança ENTRA no livro', async () => {
    /*
     * Achado novo desta revisão, e é de dinheiro.
     *
     * A correção do achado 6 fez o laço consultar o **livro** por `(episódio, etapa, modelo, hash8)` e, se
     * já houver linha, tratar o ativo como reusado e **não registrar de novo**. O problema é que esse
     * caminho é alcançado exatamente quando o provedor **acabou de regerar** o ativo — e cobrar por ele.
     *
     * Reprodução: a imagem é gerada (1 chamada paga, 1 linha no livro); o ARQUIVO é apagado (o manifesto e
     * o livro ficam); a execução seguinte não encontra o arquivo, o adapter chama a API de novo e cobra uma
     * SEGUNDA imagem. `register` vê a linha antiga no livro, conta como reuso, e a segunda cobrança não
     * entra em lugar nenhum: o episódio continua relatando o custo de UMA imagem.
     *
     * O contrato escrito no próprio módulo diz o contrário: "O erro cai para o lado de duplicar uma linha
     * (visível, corrigível) e nunca para o lado de perder gasto (invisível)".
     */
    const { runSimulatedEpisode } = await import('../../../server/media/simulated-episode.js');
    const { readLedger } = await import('../../../server/media/ledger.js');
    const fetchMock = stubFetch(respostaOk(pngSolido(1280, 720, [30, 41, 59])));

    const primeira = await runSimulatedEpisode(EPISODIO_CURTO, {
      now: new Date('2026-10-02T12:00:00.000Z'),
      imageProvider: 'auto',
    });
    const linhasDeImagem = () => {
      const { header, rows } = readLedger();
      const etapa = header.indexOf('etapa');
      return rows.filter((row) => (row[etapa] ?? '').trim() === 'imagem');
    };
    const arquivo = primeira.assets.find((asset) => asset.stage === 'imagem')?.path ?? '';
    expect(fetchMock.mock.calls.length).toBe(1); // 1 imagem paga
    expect(linhasDeImagem()).toHaveLength(1); // 1 linha no livro
    expect(existsSync(arquivo)).toBe(true);

    // Apaga SÓ o arquivo: manifesto e livro continuam dizendo que ele existe.
    rmSync(arquivo, { force: true });

    const segunda = await runSimulatedEpisode(EPISODIO_CURTO, {
      now: new Date('2026-10-02T12:05:00.000Z'),
      imageProvider: 'auto',
    });

    // Duas imagens foram COBRADAS (duas requisições ao provedor pago)...
    expect(fetchMock.mock.calls.length).toBe(2);
    // ...e as DUAS cobranças estão no livro: duas linhas, e o custo do episódio dobrou. Este número é o
    // mesmo que os portões de teto leem — antes, metade do gasto era invisível para eles.
    expect(linhasDeImagem()).toHaveLength(2);
    expect(segunda.cost.totalUsd).toBeCloseTo(2 * 0.0035, 10);
    // E o relatório diz a verdade sobre o que aconteceu: foi GERADO agora (o provedor cobrou), não reusado.
    expect(segunda.assets.filter((asset) => asset.stage === 'imagem').every((asset) => !asset.reused)).toBe(true);
  }, TIMEOUT);

  /*
   * INVERTIDO em 2026-10-02 (achado NOVO do QA-016, gravidade MÉDIA).
   * Reprodução mínima do defeito que ele media, preservada (sem ffmpeg, IHDR 0x0):
   *
   *   process.env['REBECA_FFMPEG'] = 'ffmpeg-que-nao-existe-qa016';
   *   stubFetch(respostaOk(pngEstrutural({ width: 0, height: 0, pixelsCrus: Buffer.alloc(8) })));
   *   const asset = await miniMaxImageProvider.render(PEDIDO);
   *   expect(existsSync(asset.path)).toBe(true);   // ← promovido ao destino como se fosse arte boa
   *   expect(asset.costUsd).toBeCloseTo(0.0035, 10);
   *   // e a idempotência passava a confiar nele: a segunda chamada nem tocava a rede
   *
   * Causa: a camada 1 não validava o IHDR, e a camada 2 é condicional (a rota de thumbnail roda em
   * ambiente que pode não ter ffmpeg). A inversão é MAIS ESTRITA: exige a recusa e nada no disco.
   */
  it('CORRIGIDO (QA-016, achado MÉDIA, 2026-10-02): sem ffmpeg, um PNG com IHDR impossível é RECUSADO', async () => {
    /*
     * A camada 2 da validação é condicional: `if (ffmpegAvailable())`. E `ffmpegAvailable()` responde
     * "não" sempre que o binário não está onde `REBECA_FFMPEG`/PATH aponta — inclusive numa instalação
     * sem ffmpeg, onde a rota de imagem ainda funciona (o adapter real não usa ffmpeg para gerar).
     *
     * Por isso a camada 1 tem de bastar sozinha: ela agora confere os campos do IHDR (dimensão,
     * `colorType`, `bitDepth`, `interlace`) e o tamanho dos pixels descomprimidos.
     */
    const { resetFfmpegAvailabilityCache } = await import('../../../server/media/ffmpeg.js');
    const anterior = process.env['REBECA_FFMPEG'];
    process.env['REBECA_FFMPEG'] = 'ffmpeg-que-nao-existe-qa016';
    resetFfmpegAvailabilityCache();
    try {
      stubFetch(respostaOk(pngEstrutural({ width: 0, height: 0, pixelsCrus: Buffer.alloc(8) })));
      const path = planMiniMaxImage(PEDIDO).path;

      await expect(miniMaxImageProvider.render(PEDIDO)).rejects.toThrowError(/está incompleto/);
      // E nada é promovido: nem destino, nem arquivo de passagem.
      expect(existsSync(path)).toBe(false);
      expect(existsSync(`${path}.parcial`)).toBe(false);
    } finally {
      if (anterior === undefined) delete process.env['REBECA_FFMPEG'];
      else process.env['REBECA_FFMPEG'] = anterior;
      resetFfmpegAvailabilityCache();
    }
  });

  /*
   * INVERTIDO em 2026-10-02 (achado NOVO do QA-016, gravidade MÉDIA).
   * Reprodução mínima do defeito que ele media, preservada: os quatro arquivos abaixo têm assinatura,
   * chunks com CRC correto, `IDAT` que descomprime e `IEND`, e nenhum é imagem decodificável — a recusa
   * vinha da **camada 2** em todos os quatro, prova de que a camada 1 os aceitava. O que ela não
   * conferia: os campos do IHDR (dimensões, `colorType`, `bitDepth`, `interlace`).
   *
   * A inversão é MAIS ESTRITA: agora quem recusa é a **camada 1** (a única que existe quando não há
   * ffmpeg), e a asserção exige a mensagem dela — não a da camada 2.
   */
  it('CORRIGIDO (QA-016, achado MÉDIA, 2026-10-02): a camada 1 valida o IHDR — os quatro caem nela', async () => {
    const casos: ReadonlyArray<{ readonly nome: string; readonly bytes: Buffer }> = [
      { nome: 'IHDR 0x0', bytes: pngEstrutural({ width: 0, height: 0, pixelsCrus: Buffer.alloc(8) }) },
      { nome: 'colorType=99', bytes: pngEstrutural({ width: 1, height: 1, colorType: 99, pixelsCrus: Buffer.alloc(4) }) },
      { nome: 'bitDepth=7', bytes: pngEstrutural({ width: 1, height: 1, bitDepth: 7, pixelsCrus: Buffer.alloc(4) }) },
      { nome: 'IDAT sem pixels (1x1 RGB)', bytes: pngEstrutural({ width: 1, height: 1, pixelsCrus: Buffer.alloc(0) }) },
    ];

    for (const caso of casos) {
      stubFetch(respostaOk(caso.bytes));
      let capturado: unknown = null;
      try {
        await miniMaxImageProvider.render(PEDIDO);
      } catch (error) {
        capturado = error;
      }
      const mensagem = capturado instanceof Error ? capturado.message : 'ACEITO SEM ERRO';
      // `está incompleto` é a frase da CAMADA 1 — a que não depende de binário nenhum.
      expect(`${caso.nome}: ${mensagem}`).toMatch(/está incompleto/);
      // Nada foi promovido ao destino: o parcial é apagado.
      expect(existsSync(planMiniMaxImage(PEDIDO).path)).toBe(false);
    }
  });

  /*
   * INVERTIDO em 2026-10-02 (achado NOVO do QA-016, gravidade BAIXA).
   * Reprodução mínima do defeito que ele media, preservada:
   *
   *   // IHDR com interlace 7 (o formato só define 0 e 1)
   *   stubFetch(respostaOk(pngEstrutural({ width: 1, height: 1, interlace: 7, pixelsCrus: Buffer.alloc(4) })));
   *   const asset = await miniMaxImageProvider.render(PEDIDO);
   *   expect(existsSync(asset.path)).toBe(true);          // ← virava o ativo do canal
   *   expect(asset.costUsd).toBeCloseTo(0.0035, 10);
   *
   * Causa: a camada 1 não olhava o campo, e o ffmpeg decodifica 1 quadro e sai 0 — então `isUsableImage`
   * passava a considerar o arquivo bom. A inversão é MAIS ESTRITA: exige a recusa e nada no disco.
   */
  it('CORRIGIDO (QA-016, achado BAIXA, 2026-10-02): `interlace` inválido é recusado na camada 1', async () => {
    stubFetch(respostaOk(pngEstrutural({ width: 1, height: 1, interlace: 7, pixelsCrus: Buffer.alloc(4) })));
    const path = planMiniMaxImage(PEDIDO).path;

    await expect(miniMaxImageProvider.render(PEDIDO)).rejects.toThrowError(/interlace 7/);
    expect(existsSync(path)).toBe(false);
  });

  /*
   * ATUALIZADO em 2026-10-02 (achado NOVO do QA-016): este caso era o "5º que a camada 1 deixa passar" —
   * quem o recusava era o ffmpeg. A inversão do achado MÉDIA fez a camada 1 conferir também o **tamanho
   * dos pixels descomprimidos**, então ele passou a cair na camada 1. A asserção mudou de frase, e ficou
   * MAIS ESTRITA: antes exigia "a camada 2 recusou", agora exige "a camada 1 recusou" — a que vale mesmo
   * sem ffmpeg no ambiente.
   */
  it('ATUALIZADO (QA-016, 2026-10-02): pixels insuficientes para as dimensões caem já na camada 1', async () => {
    /*
     * IHDR declara 8x8 RGB (que exige 8 × (1 + 24) = 200 bytes de pixels) e o `IDAT` descomprime para 4.
     * Estruturalmente íntegro (CRCs certos, zlib válido, IEND presente) — o que não dá para aceitar é o
     * arquivo ter menos pixel do que as dimensões que ele mesmo declara.
     *
     * Nota de método (do QA, preservada): numa primeira medição este caso apareceu como **aceito**. Era
     * contaminação do instrumento — duas sondas usavam o MESMO `PEDIDO`, logo o mesmo caminho de arquivo,
     * no mesmo diretório temporário: a segunda encontrou o arquivo promovido pela primeira e respondeu
     * pelo caminho de reuso. Medido isolado, é recusado.
     */
    stubFetch(respostaOk(pngEstrutural({ width: 8, height: 8, pixelsCrus: Buffer.alloc(4) })));

    let capturado: unknown = null;
    try {
      await miniMaxImageProvider.render(PEDIDO);
    } catch (error) {
      capturado = error;
    }

    expect(String((capturado as Error).message)).toMatch(/está incompleto: o IDAT descomprime para 4 bytes/);
    expect(existsSync(planMiniMaxImage(PEDIDO).path)).toBe(false);
  });
});

/* =============================================================================
   QA-016 — a correção não alcançou o adapter de thumbnail que ESTÁ EM USO
   ============================================================================= */

/*
 * INVERTIDO em 2026-10-02 (achados NOVOS do QA-016, gravidade ALTA nos dois), depois da extração da
 * validação para `server/media/providers/image-integrity.ts` — **uma** implementação usada pelos dois
 * adapters. Reprodução mínima dos defeitos preservada em cada teste; nenhuma asserção afrouxada.
 */
describe('QA-016 — o adapter da OpenAI (thumbnail), que ESTÁ EM USO', () => {
  const PEDIDO_THUMB = {
    channelId: 'luna',
    scopeChannelId: 'luna',
    episodeId: 'luna-ep-qa',
    promptVersion: 'criar-thumbnail@v1',
    optionId: 'a',
    prompt: 'Luna no jardim, cores da paleta',
    textOnImage: 'LUNA E AS CORES',
    hypothesis: 'foco no personagem',
    width: 1280,
    height: 720,
    seed: 7,
  };

  /*
   * Reprodução mínima do defeito que este teste media, preservada:
   *
   *   const lixo = Buffer.from('<!doctype html><html>erro do provedor</html>', 'utf8');
   *   stubFetch({ data: [{ b64_json: lixo.toString('base64') }] });
   *   await expect(openAiThumbnailProvider.generate(PEDIDO_THUMB)).rejects.toThrowError(/não é um PNG/);
   *   expect(existsSync(path)).toBe(true);                       // ← o lixo FICAVA no disco
   *   expect(readFileSync(path).toString('utf8')).toContain('erro do provedor');
   *   const segunda = await openAiThumbnailProvider.generate(PEDIDO_THUMB);
   *   expect(fetchDepois).not.toHaveBeenCalled();                // ← "sucesso grátis"
   *   expect(segunda.costUsd).toBe(0);
   *
   * Causa: `writeFileSync(path, bytes)` antes de conferir a assinatura, e `existsSync` como reuso. A
   * inversão é MAIS ESTRITA: exige que nada fique no disco e que a retentativa volte à rede e falhe.
   */
  it('CORRIGIDO (QA-016, achado ALTA, 2026-10-02): a OpenAI grava só depois de validar — nada sobra no disco', async () => {
    /*
     * `server/media/thumbnails.ts` escolhe a OpenAI **antes** da MiniMax quando há chave — e há: o livro
     * tem 13 linhas de thumbnail `openai / gpt-image-2.5-sunburst`. Ou seja, **este é o caminho pago de
     * thumbnail em uso**, e era ele que estava sem a validação que a Fase 2 construiu.
     */
    process.env['OPENAI_API_KEY'] = 'chave-de-teste-nao-real';
    try {
      const { providerForThumbnails } = await import('../../../server/media/thumbnails.js');
      const { openAiThumbnailProvider, planOpenAiThumbnail } = await import(
        '../../../server/media/providers/openai.js'
      );
      expect(providerForThumbnails().provider.id).toBe(openAiThumbnailProvider.id);

      const lixo = Buffer.from('<!doctype html><html>erro do provedor</html>', 'utf8');
      const fetchMock = stubFetch({ data: [{ b64_json: lixo.toString('base64') }] });
      const path = planOpenAiThumbnail(PEDIDO_THUMB).path;

      await expect(openAiThumbnailProvider.generate(PEDIDO_THUMB)).rejects.toThrowError(/não é um PNG/);
      // Nada no destino e nada de arquivo de passagem: não há ativo, e é isso que o disco tem de dizer.
      expect(existsSync(path)).toBe(false);
      expect(existsSync(`${path}.parcial`)).toBe(false);

      // E a retentativa NÃO pode responder "já tenho isso": ela volta à rede e falha de novo.
      fetchMock.mockClear();
      await expect(openAiThumbnailProvider.generate(PEDIDO_THUMB)).rejects.toThrowError(/não é um PNG/);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(existsSync(path)).toBe(false);
    } finally {
      delete process.env['OPENAI_API_KEY'];
    }
  });

  /*
   * Reprodução mínima do defeito que este teste media, preservada:
   *
   *   writeFileSync(path, Buffer.alloc(0));   // arquivo de ZERO bytes com o nome certo
   *   const asset = await openAiThumbnailProvider.generate(PEDIDO_THUMB);
   *   expect(fetchMock).not.toHaveBeenCalled();   // ← "ativo pronto", sem tocar a rede
   *   expect(asset.costUsd).toBe(0);
   *   expect(readFileSync(asset.path).length).toBe(0);
   *
   * Causa: `existsSync` como checagem de reuso. A inversão é MAIS ESTRITA: exige requisição nova e um
   * arquivo que agora é um PNG de verdade (não vazio).
   */
  it('CORRIGIDO (QA-016, achado ALTA, 2026-10-02): arquivo de zero byte não é ativo — é regerado', async () => {
    process.env['OPENAI_API_KEY'] = 'chave-de-teste-nao-real';
    try {
      const { openAiThumbnailProvider, planOpenAiThumbnail } = await import(
        '../../../server/media/providers/openai.js'
      );
      const path = planOpenAiThumbnail(PEDIDO_THUMB).path;
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, Buffer.alloc(0));

      const pngValido = pngSolido(1280, 720, [30, 41, 59]);
      const fetchMock = stubFetch({ data: [{ b64_json: pngValido.toString('base64') }] });

      const asset = await openAiThumbnailProvider.generate(PEDIDO_THUMB);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(asset.costUsd).toBeGreaterThan(0);
      expect(readFileSync(asset.path).length).toBe(pngValido.length);
      expect(asset.path).toBe(path);
    } finally {
      delete process.env['OPENAI_API_KEY'];
    }
  });
});
