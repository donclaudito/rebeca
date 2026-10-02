/**
 * Gerador de thumbnail — allow-list, idempotência, custo e a rota que serve a arte.
 *
 * Contexto do defeito que originou isto: o botão "Gerar opções de thumbnail com a IA" na tela de Revisão
 * chamava a função de **LLM** `criar-thumbnail`, que devolve **conceito em texto** — nunca gerou imagem.
 * O dono do produto clicou, não apareceu arte nenhuma e relatou: *"não está produzindo, não gera"*.
 *
 * Estes testes cobrem o que passou a existir — e atacam os modos de falha que importam:
 *
 * 1. **Gastar sem autorização.** Fornecedor `PROIBIDO` ou `NAO-VERIFICADO` tem de ser recusado **antes**
 *    de qualquer chamada de rede, com o fundamento e a URL na mensagem.
 * 2. **Cobrar sem preço declarado.** Provedor que se diz pago e declara custo zero faria o portão
 *    comparar `0` com o teto e liberar tudo — o furo que o `rebeca-qa` reproduziu no `ADR-010`.
 * 3. **Pagar duas vezes.** Reexecutar tem de reusar o manifesto e **não** criar linha nova no livro.
 * 4. **Servir arquivo que ninguém registrou.** A rota de arquivo só serve o que está no manifesto; a
 *    defesa contra travessia é a whitelist, não a sanitização do caminho.
 *
 * Tudo em `REBECA_ROOT` temporário: a suíte não pode escrever na árvore de assets nem no livro de custos
 * do projeto.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GeneratedAsset, ThumbnailProvider, ThumbnailRequest } from '../contract.js';
import { assertProviderAllowed, loadAllowList, ProviderNotAllowedError } from '../../../server/media/allow-list.js';
import { generateThumbnails, OPCOES_PADRAO, opcoesPara, seedFor } from '../../../server/media/thumbnails.js';
import { miniMaxThumbnailProvider } from '../../../server/media/providers/minimax.js';
import { SIMULATED_MODELS, SIMULATED_PROVIDERS } from '../../../server/media/providers/simulated.js';
import { ffmpegAvailable } from '../../../server/media/ffmpeg.js';
import { routeMediaRequest as rotaDeMidiaSemIdentidade } from '../../../server/media/http.js';
import {
  autenticacaoDeTeste,
  CLIENT_ID_DE_TESTE,
  isolarAmbiente,
  SUB_AUTORIZADO,
} from '../../auth/__tests__/test-support.js';
import { MediaBudgetError } from '../limits.js';

const HAS_FFMPEG = ffmpegAvailable();

let tempDir = '';
let restaurarAmbiente: () => void = () => {};

/**
 * Rota de mídia **com identidade**.
 *
 * O que este arquivo mede é a geração em si — portões de fornecedor, idempotência, livro de custos. A
 * fronteira de acesso é medida em `src/auth/__tests__/rotas.test.ts`, que prova o 401 sem credencial,
 * o 403 de conta fora da lista e que a geração recusada **não** escreve no livro de custos.
 */
const routeMediaRequest = (
  method: string,
  pathname: string,
  searchParams: URLSearchParams,
  body?: unknown,
) => rotaDeMidiaSemIdentidade(method, pathname, searchParams, async () => body, autenticacaoDeTeste());

/** Allow-list do teste: a do projeto é dado de produção e não deve ser editada pela suíte. */
function escreverAllowList(entradas: unknown[]): void {
  const path = join(tempDir, '.rebeca', 'canais', 'luna', 'allow-list.json');
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(
    path,
    JSON.stringify({ canal: 'luna', nome: 'Luna', publico: 'infantil', atualizadoEm: '2026-10-01', fonte: 'teste', regra: 'teste', entradas }, null, 2),
    'utf8',
  );
}

const PERMITIDO_SIMULADO = {
  fornecedor: 'simulado-thumbnail',
  modelo: SIMULATED_MODELS.thumbnail,
  finalidade: 'thumbnail',
  status: 'PERMITIDO',
  fundamento: 'procedência local, sem terceiro',
  fonteUrl: 'https://ffmpeg.org/legal.html',
  lidoEm: '2026-10-01',
  aprovadoPor: 'humano:teste',
  aprovadoEm: '2026-10-01',
};

beforeEach(() => {
  // A guarda falha fechada: sem estes dois o arquivo mediria a guarda, não a geração.
  restaurarAmbiente = isolarAmbiente();
  process.env['GOOGLE_CLIENT_ID'] = CLIENT_ID_DE_TESTE;
  process.env['REBECA_ALLOWED_SUBS'] = SUB_AUTORIZADO;

  tempDir = mkdtempSync(join(tmpdir(), 'rebeca-thumb-'));
  process.env['REBECA_ROOT'] = tempDir;
  process.env['REBECA_COST_LEDGER'] = join(tempDir, 'custos.csv');
  delete process.env['REBECA_ASSETS_ROOT'];
  delete process.env['REBECA_MINIMAX_API_KEY'];
  escreverAllowList([PERMITIDO_SIMULADO]);
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
  delete process.env['REBECA_ROOT'];
  delete process.env['REBECA_COST_LEDGER'];
  delete process.env['REBECA_MINIMAX_API_KEY'];
  restaurarAmbiente();
  vi.unstubAllGlobals();
});

describe('allow-list de fornecedor por canal', () => {
  it('recusa fornecedor marcado como PROIBIDO, citando o fundamento e a fonte', () => {
    escreverAllowList([
      {
        fornecedor: 'google',
        modelo: '*',
        finalidade: '*',
        status: 'PROIBIDO',
        fundamento: 'cláusula de Age Requirements veda serviço dirigido a menores de 18',
        fonteUrl: 'https://ai.google.dev/gemini-api/terms',
        lidoEm: '2026-10-01',
        aprovadoPor: 'humano:dono-do-produto',
        aprovadoEm: '2026-10-01',
      },
    ]);

    try {
      assertProviderAllowed({ channelId: 'luna', provider: 'google', model: 'nano-banana', purpose: 'thumbnail' });
      throw new Error('deveria ter recusado');
    } catch (error) {
      expect(error).toBeInstanceOf(ProviderNotAllowedError);
      const recusa = error as ProviderNotAllowedError;
      expect(recusa.code).toBe('fornecedor-proibido');
      // A mensagem tem de permitir DISCORDAR: sem o fundamento e a URL, o humano refaz a apuração inteira.
      expect(recusa.message).toContain('Age Requirements');
      expect(recusa.message).toContain('ai.google.dev/gemini-api/terms');
      expect(recusa.message).toContain('Nada foi gerado e nada foi gasto');
    }
  });

  it('recusa fornecedor NÃO VERIFICADO — silêncio contratual não é permissão', () => {
    escreverAllowList([
      {
        fornecedor: 'flux',
        modelo: 'FLUX.2-klein',
        finalidade: 'imagem',
        status: 'NAO-VERIFICADO',
        fundamento: 'termo nunca lido',
        fonteUrl: 'https://bfl.ai/legal/terms-of-service',
        lidoEm: '2026-10-01',
        aprovadoPor: null,
        aprovadoEm: null,
      },
    ]);

    expect(() =>
      assertProviderAllowed({ channelId: 'luna', provider: 'flux', model: 'FLUX.2-klein', purpose: 'imagem' }),
    ).toThrowError(/NÃO VERIFICADO/);
  });

  it('recusa quando não existe allow-list para o canal', () => {
    rmSync(join(tempDir, '.rebeca', 'canais', 'luna', 'allow-list.json'), { force: true });

    try {
      assertProviderAllowed({ channelId: 'luna', provider: 'minimax', model: 'image-01', purpose: 'thumbnail' });
      throw new Error('deveria ter recusado');
    } catch (error) {
      expect((error as ProviderNotAllowedError).code).toBe('lista-ausente');
    }
  });

  it('aceita o fornecedor PERMITIDO e o `*` casa sem virar passe livre para outro fornecedor', () => {
    escreverAllowList([
      PERMITIDO_SIMULADO,
      {
        fornecedor: 'minimax',
        modelo: '*',
        finalidade: '*',
        status: 'PROIBIDO',
        fundamento: 'teste',
        fonteUrl: 'https://exemplo',
        lidoEm: '2026-10-01',
        aprovadoPor: null,
        aprovadoEm: null,
      },
    ]);

    const ok = assertProviderAllowed({
      channelId: 'luna',
      provider: 'simulado-thumbnail',
      model: SIMULATED_MODELS.thumbnail,
      purpose: 'thumbnail',
    });
    expect(ok.fornecedor).toBe('simulado-thumbnail');

    // O `*` da MiniMax não autoriza a Luma.
    expect(() =>
      assertProviderAllowed({ channelId: 'luna', provider: 'luma', model: 'photon', purpose: 'thumbnail' }),
    ).toThrowError(ProviderNotAllowedError);
  });

  it('recusa identificador de canal com travessia antes de abrir arquivo', () => {
    expect(() => loadAllowList('..')).toThrowError(/não é um identificador válido/);
  });
});

describe('geração das opções de thumbnail', () => {
  it.skipIf(!HAS_FFMPEG)('gera quatro opções com hipóteses diferentes e registra no manifesto', async () => {
    const result = await generateThumbnails({
      channelId: 'luna',
      episodeId: 'luna-borboletas',
      promptVersion: 'criar-thumbnail@v1',
      options: OPCOES_PADRAO,
      provider: SIMULATED_PROVIDERS.thumbnail,
    });

    expect(result.created).toBe(4);
    expect(result.reused).toBe(0);
    expect(result.options.map((option) => option.optionId)).toEqual(['a', 'b', 'c', 'd']);
    // Quatro opções, quatro hipóteses distintas — não quatro variações da mesma aposta.
    expect(new Set(result.options.map((option) => option.hypothesis)).size).toBe(4);
    expect(result.options.every((option) => option.simulated)).toBe(true);
    expect(result.options.every((option) => option.bytes > 0)).toBe(true);
    expect(result.cost.spentNowUsd).toBe(0);
  });

  it.skipIf(!HAS_FFMPEG)('é idempotente: a segunda execução reusa tudo e não lança custo novo', async () => {
    const input = {
      channelId: 'luna',
      episodeId: 'luna-borboletas',
      promptVersion: 'criar-thumbnail@v1',
      options: OPCOES_PADRAO,
      provider: SIMULATED_PROVIDERS.thumbnail,
    };

    const primeira = await generateThumbnails(input);
    const linhasDepoisDaPrimeira = primeira.cost.ledgerRows;

    const segunda = await generateThumbnails(input);

    expect(segunda.created).toBe(0);
    expect(segunda.reused).toBe(4);
    // O número que prova idempotência: o livro não cresceu.
    expect(segunda.cost.ledgerRows).toBe(linhasDepoisDaPrimeira);
    expect(segunda.cost.spentNowUsd).toBe(0);
  });

  it('recusa duas opções com o mesmo identificador', async () => {
    await expect(
      generateThumbnails({
        channelId: 'luna',
        episodeId: 'luna-borboletas',
        promptVersion: 'criar-thumbnail@v1',
        options: [
          { optionId: 'a', hypothesis: 'x', prompt: 'p', textOnImage: 't' },
          { optionId: 'a', hypothesis: 'y', prompt: 'q', textOnImage: 'u' },
        ],
        provider: SIMULATED_PROVIDERS.thumbnail,
      }),
    ).rejects.toThrowError(/repetido/);
  });

  /**
   * O furo do `ADR-010`, em forma de teste: provedor que cobra mas não declara preço faria o portão
   * comparar zero com o teto e liberar a geração inteira antes de qualquer verificação.
   */
  it('recusa provedor pago sem preço por imagem declarado', async () => {
    const provider: ThumbnailProvider = {
      id: 'simulado-thumbnail',
      model: SIMULATED_MODELS.thumbnail,
      simulated: false,
      costPerImageUsd: 0,
      plan: (input: ThumbnailRequest) => SIMULATED_PROVIDERS.thumbnail.plan(input),
      generate: (input: ThumbnailRequest): Promise<GeneratedAsset> => SIMULATED_PROVIDERS.thumbnail.generate(input),
    };

    try {
      await generateThumbnails({
        channelId: 'luna',
        episodeId: 'luna-borboletas',
        promptVersion: 'criar-thumbnail@v1',
        options: OPCOES_PADRAO,
        provider,
      });
      throw new Error('deveria ter recusado');
    } catch (error) {
      expect(error).toBeInstanceOf(MediaBudgetError);
      expect((error as MediaBudgetError).code).toBe('estimativa-obrigatoria');
    }
  });

  it('recusa fornecedor fora da allow-list antes de gerar qualquer coisa', async () => {
    escreverAllowList([]);

    await expect(
      generateThumbnails({
        channelId: 'luna',
        episodeId: 'luna-borboletas',
        promptVersion: 'criar-thumbnail@v1',
        options: OPCOES_PADRAO,
        provider: SIMULATED_PROVIDERS.thumbnail,
      }),
    ).rejects.toThrowError(ProviderNotAllowedError);
  });

  it('a seed é determinística — mesma entrada, mesma arte', () => {
    expect(seedFor('luna-borboletas:a')).toBe(seedFor('luna-borboletas:a'));
    expect(seedFor('luna-borboletas:a')).not.toBe(seedFor('luna-borboletas:b'));
  });

  /**
   * O relato do dono: *"ele criou o personagem mas não gerou a thumb"*.
   *
   * O prompt era **texto fixo no código** e descrevia "a small round friendly girl", afirmando ainda que
   * a ficha oficial não existia — enquanto o canal já tinha personagem oficial cadastrado. A arte mirava o
   * personagem errado e o prompt declarava uma ausência falsa.
   */
  it('o prompt cita os personagens OFICIAIS do canal, e não um personagem fixo no código', () => {
    const [opcaoA] = opcoesPara({
      personagens: [
        { name: 'Luna', role: 'Protagonista curiosa', sheetVersion: 'v2' },
        { name: 'Tico', role: 'Cachorro curioso, melhor amigo', sheetVersion: 'v2' },
      ],
      tema: 'as cores do arco-íris',
    });

    expect(opcaoA?.prompt).toContain('Tico');
    expect(opcaoA?.prompt).toContain('Cachorro curioso, melhor amigo');
    expect(opcaoA?.prompt).toContain('Luna');
    expect(opcaoA?.prompt).toContain('as cores do arco-íris');
    // A afirmação falsa não pode voltar.
    expect(opcaoA?.prompt).not.toMatch(/character sheet does not exist/i);
    // E a verdade que continua valendo é dita: ficha existe, imagem de referência não.
    expect(opcaoA?.prompt).toMatch(/NÃO existe imagem de referência/i);
  });

  it('sem personagem declarado, o prompt não inventa um personagem recorrente', () => {
    const [opcaoA] = opcoesPara({ tema: 'formas' });
    expect(opcaoA?.prompt).toMatch(/Nenhum personagem foi declarado/i);
  });

  it('as quatro opções continuam com hipóteses distintas quando há contexto', () => {
    const opcoes = opcoesPara({ personagens: [{ name: 'Tico', role: 'Cachorro' }] });
    expect(opcoes).toHaveLength(4);
    expect(new Set(opcoes.map((opcao) => opcao.hypothesis)).size).toBe(4);
  });
});

describe('adapter real da MiniMax', () => {
  function respostaMiniMax(overrides: Record<string, unknown> = {}) {
    return {
      id: 'trace-1',
      data: { image_base64: [Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]).toString('base64')] },
      metadata: { success_count: 1, failed_count: 0 },
      base_resp: { status_code: 0, status_msg: 'success' },
      ...overrides,
    };
  }

  const pedido: ThumbnailRequest = {
    channelId: 'luna',
    scopeChannelId: 'luna',
    episodeId: 'luna-borboletas',
    promptVersion: 'criar-thumbnail@v1',
    optionId: 'a',
    prompt: 'flat 2d children illustration',
    textOnImage: 'OLHA ISSO!',
    hypothesis: 'foco no personagem',
    width: 1280,
    height: 720,
    seed: 123,
  };

  it('sem chave, falha com instrução — e não tenta rede', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(miniMaxThumbnailProvider.generate(pedido)).rejects.toThrowError(/Não há chave da MiniMax/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('grava a imagem e cobra o preço real quando a resposta vem base64', async () => {
    process.env['REBECA_MINIMAX_API_KEY'] = 'chave-de-teste-nao-real';
    // Os parâmetros existem para o `mock.calls` ser tipado: sem eles, `calls[0]` é uma tupla vazia e não
    // dá para inspecionar o corpo enviado — que é justamente o que este teste precisa conferir.
    const fetchMock = vi.fn(
      async (_url: string, _init?: RequestInit) => new Response(JSON.stringify(respostaMiniMax()), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const asset = await miniMaxThumbnailProvider.generate(pedido);

    expect(asset.simulated).toBe(false);
    expect(asset.costUsd).toBeCloseTo(0.0035, 6);
    expect(asset.providerId).toBe('minimax');

    // O pedido foi 16:9 e base64 — a URL da MiniMax expira em 24h e quebraria a idempotência.
    const corpo = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as Record<string, unknown>;
    expect(corpo['aspect_ratio']).toBe('16:9');
    expect(corpo['response_format']).toBe('base64');
    expect(corpo['model']).toBe('image-01');
  });

  /**
   * A MiniMax devolve **HTTP 200 com o erro dentro do corpo**. Tratar `response.ok` como sucesso faria
   * "saldo insuficiente" virar "imagem gerada" — e a tela mostraria imagem quebrada sem dizer por quê.
   */
  it('traduz erro de saldo mesmo com HTTP 200', async () => {
    process.env['REBECA_MINIMAX_API_KEY'] = 'chave-de-teste-nao-real';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ base_resp: { status_code: 1008, status_msg: 'insufficient balance' } }), { status: 200 }),
      ),
    );

    await expect(miniMaxThumbnailProvider.generate(pedido)).rejects.toThrowError(/Saldo insuficiente/);
  });

  it('traduz chave inválida', async () => {
    process.env['REBECA_MINIMAX_API_KEY'] = 'chave-de-teste-nao-real';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ base_resp: { status_code: 2049, status_msg: 'invalid api key' } }), { status: 200 })),
    );

    await expect(miniMaxThumbnailProvider.generate(pedido)).rejects.toThrowError(/recusou a chave de API/);
  });

  it('recusa sucesso sem imagem, em vez de gravar arquivo vazio', async () => {
    process.env['REBECA_MINIMAX_API_KEY'] = 'chave-de-teste-nao-real';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ data: { image_base64: [] }, metadata: { success_count: 0, failed_count: 1 }, base_resp: { status_code: 0, status_msg: 'success' } }), { status: 200 }),
      ),
    );

    await expect(miniMaxThumbnailProvider.generate(pedido)).rejects.toThrowError(/não devolveu imagem/);
  });

  it('recusa resposta sem `base_resp.status_code` — sem ele não dá para distinguir sucesso de erro', async () => {
    process.env['REBECA_MINIMAX_API_KEY'] = 'chave-de-teste-nao-real';
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data: { image_base64: ['x'] } }), { status: 200 })));

    await expect(miniMaxThumbnailProvider.generate(pedido)).rejects.toThrowError(/sem `base_resp.status_code`/);
  });
});

describe('rota HTTP da mídia', () => {
  it('recusa travessia de caminho: só serve o que está no manifesto', async () => {
    for (const mau of ['../../segredos/llm.json', 'C:/Windows/win.ini', 'luna/../outro/x.png']) {
      const result = await routeMediaRequest(
        'GET',
        '/api/media/file',
        new URLSearchParams({ channelId: 'luna', episodeId: 'luna-borboletas', asset: mau }),
      );
      expect(result.status, `deveria recusar ${mau}`).toBe(404);
      expect((result.body as { code: string }).code).toBe('arquivo-fora-do-manifesto');
      expect(result.file).toBeUndefined();
    }
  });

  it.skipIf(!HAS_FFMPEG)('serve a imagem gerada quando ela está no manifesto', async () => {
    const gerado = await generateThumbnails({
      channelId: 'luna',
      episodeId: 'luna-borboletas',
      promptVersion: 'criar-thumbnail@v1',
      options: OPCOES_PADRAO,
      provider: SIMULATED_PROVIDERS.thumbnail,
    });

    const primeiro = gerado.options[0];
    const result = await routeMediaRequest(
      'GET',
      '/api/media/file',
      new URLSearchParams({ channelId: 'luna', episodeId: 'luna-borboletas', asset: primeiro?.pathFromAssets ?? '' }),
    );

    expect(result.status).toBe(200);
    expect(result.file?.contentType).toBe('image/png');
  });

  it('a geração exige POST', async () => {
    const result = await routeMediaRequest('GET', '/api/media/thumbnails', new URLSearchParams());
    expect(result.status).toBe(405);
  });

  it('a geração exige canal e episódio no corpo', async () => {
    const semCanal = await routeMediaRequest('POST', '/api/media/thumbnails', new URLSearchParams(), { episodeId: 'x' });
    expect(semCanal.status).toBe(400);
    expect((semCanal.body as { code: string }).code).toBe('canal-obrigatorio');

    const semEpisodio = await routeMediaRequest('POST', '/api/media/thumbnails', new URLSearchParams(), { channelId: 'luna' });
    expect(semEpisodio.status).toBe(400);
    expect((semEpisodio.body as { code: string }).code).toBe('episodio-obrigatorio');
  });
});
