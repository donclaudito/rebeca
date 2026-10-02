/**
 * Pipeline inteiro com ffmpeg de verdade — o teste que prova a Fase 0.
 *
 * Ele é **pulado** quando o `ffmpeg` não está no PATH (`it.skipIf`): a suíte não pode depender de uma
 * máquina específica nem ficar vermelha por ausência de binário. O que este teste cobre, quando roda:
 *
 * - longo em 1920×1080 a 30 fps e Short em 1080×1920 (vertical de verdade, recorte do mesmo material);
 * - legenda dentro da duração, com desvio fala↔legenda ≤ 200 ms;
 * - manifesto com todos os estágios, `simulated: true`, `reference: sintetica` e os **tetos em vigor**;
 * - **idempotência**: rodar duas vezes não cria arquivo novo nem linha nova em `.rebeca/custos.csv`;
 * - **portão de fornecedor no caminho de vídeo**: fornecedor `PROIBIDO` ou canal sem allow-list é
 *   recusado antes de escrever qualquer arquivo — inclusive quando o cache atenderia tudo;
 * - nenhum arquivo com nome não determinístico (`*final*`).
 *
 * Tudo em diretórios temporários (`REBECA_ROOT`, `REBECA_ASSETS_ROOT` e `REBECA_COST_LEDGER`): o teste
 * gera vídeo de verdade e não pode sujar a árvore de ativos nem o livro de custos do projeto.
 */

import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { EpisodeSpec } from '../../../server/media/simulated-episode.js';
import { ffmpegAvailable } from '../../../server/media/ffmpeg.js';
import { ledgerRowCount } from '../../../server/media/ledger.js';
import { SIMULATED_MODELS } from '../../../server/media/providers/simulated.js';
import { resetMemoryLedger } from '../../../server/ai/ledger.js';

const HAS_FFMPEG = ffmpegAvailable();
const TIMEOUT = 300_000;

let tempDir = '';

/**
 * Episódio curto de propósito: 2 cenas de ~3 s. O que está sob teste é o caminho completo, não o volume —
 * e um episódio de 30 s deixaria a suíte lenta sem provar nada a mais.
 */
const EPISODIO_DE_TESTE: EpisodeSpec = {
  channelId: 'luna',
  channelName: 'Luna e o Jardim das Cores',
  episodeId: 'luna-ep-teste',
  slug: 'luna-ep-teste',
  title: 'Episódio de teste (referência sintética)',
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
      seed: 11,
    },
    {
      id: 'cena-02',
      index: 2,
      narration: 'Ela corre para contar ao Bento.',
      onScreenText: 'Cena 2 — teste',
      imagePrompt: 'Referência sintética: personagem correndo no jardim.',
      emotion: 'alegria',
      seed: 22,
    },
  ],
};

/**
 * Uma entrada de allow-list para os provedores usados aqui.
 *
 * O caminho de vídeo passou a **consultar** esta lista antes de gerar (o furo que ela fecha está
 * descrito no `simulated-episode.ts`). Sem escrevê-la no `REBECA_ROOT` temporário, a suíte passaria a
 * ler o arquivo de **produção** `.rebeca/canais/luna/allow-list.json` — e ficaria vermelha no dia em
 * que alguém editasse o dado real. Teste que mede o ambiente em vez do produto não protege nada.
 */
function entradaSimulada(fornecedor: string, modelo: string, finalidade: string): Record<string, string> {
  return {
    fornecedor,
    modelo,
    finalidade,
    status: 'PERMITIDO',
    fundamento: 'geração local por ffmpeg, sem terceiro, sem rede, sem chave',
    fonteUrl: 'https://ffmpeg.org/legal.html',
    lidoEm: '2026-10-01',
    aprovadoPor: 'humano:teste',
    aprovadoEm: '2026-10-01',
  };
}

const ALLOW_LIST_F0: Array<Record<string, string>> = [
  // Os modelos vêm das **constantes**, não de literais: quando a fórmula do gerador muda, o sufixo
  // numérico sobe e o hash muda junto (é assim que o pipeline deixa de reusar arquivo gerado por outra
  // regra). Com o nome escrito à mão aqui, subir a versão do gerador derrubava este teste — e a causa
  // aparecia como "fornecedor fora da allow-list", que não é o que ele mede.
  entradaSimulada('simulado-imagem', SIMULATED_MODELS.image, 'imagem'),
  entradaSimulada('simulado-animacao', SIMULATED_MODELS.video, 'animacao'),
  entradaSimulada('simulado-voz', SIMULATED_MODELS.tts, 'voz'),
  entradaSimulada('simulado-musica', SIMULATED_MODELS.music, 'musica'),
  // O provedor pago falso do primeiro teste é PERMITIDO de propósito: o que aquele teste mede é o portão
  // de CUSTO. Se a allow-list o recusasse, o teste passaria pelo motivo errado.
  entradaSimulada('provedor-pago-fake', 'modelo-pago-fake', 'imagem'),
];

function escreverAllowList(entradas: Array<Record<string, string>>): void {
  const path = join(tempDir, '.rebeca', 'canais', 'luna', 'allow-list.json');
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(
    path,
    JSON.stringify(
      { canal: 'luna', nome: 'Luna', publico: 'infantil', atualizadoEm: '2026-10-01', fonte: 'teste', regra: 'teste', entradas },
      null,
      2,
    ),
    'utf8',
  );
}

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'rebeca-media-render-'));
  process.env['REBECA_ROOT'] = tempDir;
  process.env['REBECA_COST_LEDGER'] = join(tempDir, 'custos.csv');
  process.env['REBECA_ASSETS_ROOT'] = join(tempDir, 'assets');
  escreverAllowList(ALLOW_LIST_F0);
  resetMemoryLedger();
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
  delete process.env['REBECA_ROOT'];
  delete process.env['REBECA_COST_LEDGER'];
  delete process.env['REBECA_ASSETS_ROOT'];
  resetMemoryLedger();
});

function listarArquivos(): string[] {
  return readdirSync(join(tempDir, 'assets'), { recursive: true, encoding: 'utf8' })
    .map((item) => item.replaceAll('\\', '/'))
    .sort();
}

describe('render de verdade com ffmpeg local', () => {
  it.skipIf(!HAS_FFMPEG)(
    'recusa gerar com provedor PAGO e sem estimativa — antes de escrever qualquer arquivo',
    async () => {
      /*
       * Achado de gravidade alta do `rebeca-qa`: o portão de entrada usava `estimateUsd ?? 0`, então um
       * chamador sem estimativa fazia o portão comparar ZERO com o teto — passava — e o pipeline gerava
       * tudo antes de o portão de saída (com custo medido) disparar. Na reprodução do QA, com provedor
       * de US$ 50 por ativo: 21 arquivos e US$ 200 lançados antes de qualquer bloqueio.
       *
       * Este é o teste que faltava: o de `limits.ts` é unitário e não cobre o caminho do pipeline.
       */
      const { runSimulatedEpisode } = await import('../../../server/media/simulated-episode.js');
      const { SIMULATED_PROVIDERS } = await import('../../../server/media/providers/simulated.js');
      const { MediaBudgetError } = await import('../limits.js');

      // A allow-list permite este provedor **de propósito** (ver `ALLOW_LIST_F0`): o que este teste mede
      // é o portão de CUSTO, e ele só é alcançado depois de o portão de fornecedor passar. Sem isso, o
      // teste ficaria verde pelo motivo errado — recusado por política, não por orçamento.
      const comProvedorPago = {
        ...SIMULATED_PROVIDERS,
        image: { ...SIMULATED_PROVIDERS.image, id: 'provedor-pago-fake', model: 'modelo-pago-fake', simulated: false },
      };

      const linhasAntes = ledgerRowCount();
      let capturado: unknown = null;
      try {
        await runSimulatedEpisode(EPISODIO_DE_TESTE, {
          now: new Date('2026-10-01T12:00:00.000Z'),
          providers: comProvedorPago,
        });
      } catch (error) {
        capturado = error;
      }

      expect(capturado).toBeInstanceOf(MediaBudgetError);
      expect((capturado as { code?: string }).code).toBe('estimativa-obrigatoria');
      // O ponto do achado: **nada** foi gerado nem cobrado antes de recusar.
      expect(ledgerRowCount()).toBe(linhasAntes);
      expect(existsSync(join(tempDir, 'assets', 'luna', 'luna-ep-teste'))).toBe(false);
    },
    TIMEOUT,
  );

  it.skipIf(!HAS_FFMPEG)(
    'gera longo 16:9, Short 9:16, legenda e manifesto — e a segunda execução não cria nada',
    async () => {
      const { runSimulatedEpisode } = await import('../../../server/media/simulated-episode.js');
      const { readManifest } = await import('../../../server/media/manifest.js');

      // --- primeira execução ---------------------------------------------------
      const primeira = await runSimulatedEpisode(EPISODIO_DE_TESTE, { now: new Date('2026-10-01T12:00:00.000Z') });

      expect(primeira.probes.long.width).toBe(1920);
      expect(primeira.probes.long.height).toBe(1080);
      expect(primeira.probes.long.fps).toBe(30);
      expect(primeira.probes.long.durationMs).toBeGreaterThan(0);
      expect(primeira.probes.long.hasAudio).toBe(true);

      expect(primeira.probes.short.width).toBe(1080);
      expect(primeira.probes.short.height).toBe(1920);
      expect(primeira.probes.short.durationMs).toBeGreaterThan(0);

      expect(statSync(primeira.renders.captions.path).size).toBeGreaterThan(0);
      expect(primeira.renders.long.path).not.toBe(primeira.renders.short.path);

      // Legenda: nenhum bloco depois do fim, desvio dentro do teto.
      const srt = readFileSync(primeira.renders.captions.path, 'utf8');
      const tempos = [...srt.matchAll(/(\d\d):(\d\d):(\d\d),(\d\d\d) --> (\d\d):(\d\d):(\d\d),(\d\d\d)/g)];
      expect(tempos).toHaveLength(2);
      for (const match of tempos) {
        const inicio = Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]) + Number(match[4]) / 1000;
        const fim = Number(match[5]) * 3600 + Number(match[6]) * 60 + Number(match[7]) + Number(match[8]) / 1000;
        expect(inicio).toBeLessThan(primeira.captionsInfo.videoMs / 1000);
        expect(fim).toBeLessThanOrEqual(primeira.captionsInfo.videoMs / 1000 + 0.001);
      }
      expect(primeira.captionsInfo.maxDriftMs).toBeLessThanOrEqual(200);
      expect(primeira.captionsInfo.lastEndMs).toBe(primeira.captionsInfo.videoMs);

      // Custo: simulado é custo zero real, e o teto em vigor aparece no relatório.
      expect(primeira.cost.totalUsd).toBe(0);
      expect(primeira.cost.usdPerMinute).toBe(0);
      expect(primeira.cost.perMinuteLimitUsd).toBe(12);
      expect(primeira.cost.monthlyLimitUsd).toBe(60);
      expect(primeira.assets.every((asset) => asset.simulated && asset.costUsd === 0)).toBe(true);

      // Manifesto: um registro por estágio, referência declarada e tetos gravados junto do gasto.
      const manifesto = readManifest('luna', 'luna', 'luna-ep-teste');
      expect(manifesto).not.toBeNull();
      const estagios = new Set((manifesto?.assets ?? []).map((asset) => asset.stage));
      for (const estagio of ['imagem', 'animacao', 'voz', 'musica', 'render', 'legenda']) {
        expect(estagios.has(estagio as never), `estágio ausente no manifesto: ${estagio}`).toBe(true);
      }
      expect(manifesto?.assets.every((asset) => asset.reference === 'sintetica')).toBe(true);
      expect(manifesto?.assets.every((asset) => asset.simulated)).toBe(true);
      expect(manifesto?.limits.tetoPorMinutoUsd).toBe(12);
      expect(manifesto?.limits.limiteMensalUsd).toBe(60);
      expect(manifesto?.referenciaVisual.characterSheet).toBe('ausente');

      const arquivosPrimeira = listarArquivos();
      const linhasPrimeira = ledgerRowCount();
      expect(linhasPrimeira).toBe(primeira.created);

      // Nada de nome não determinístico.
      expect(arquivosPrimeira.filter((nome) => nome.includes('final'))).toEqual([]);

      // --- segunda execução: mesmo episódio, mesmo estado -----------------------
      const segunda = await runSimulatedEpisode(EPISODIO_DE_TESTE, { now: new Date('2026-10-01T12:05:00.000Z') });

      expect(segunda.created).toBe(0);
      expect(segunda.reused).toBe(primeira.created);
      expect(segunda.version).toBe(primeira.version);
      expect(segunda.renders.long.path).toBe(primeira.renders.long.path);
      expect(segunda.renders.short.path).toBe(primeira.renders.short.path);

      // As duas provas de idempotência: nenhum arquivo novo e nenhuma linha nova de custo.
      expect(listarArquivos()).toEqual(arquivosPrimeira);
      expect(ledgerRowCount()).toBe(linhasPrimeira);

      // E o formato continua correto na segunda passada (foi medido, não presumido).
      expect(segunda.probes.long.width).toBe(1920);
      expect(segunda.probes.short.height).toBe(1920);
    },
    TIMEOUT,
  );

  it.skipIf(!HAS_FFMPEG)(
    'registra o custo por ativo gerado e nada quando tudo é reusado',
    async () => {
      const { runSimulatedEpisode } = await import('../../../server/media/simulated-episode.js');
      const { readLedger } = await import('../../../server/media/ledger.js');

      await runSimulatedEpisode(EPISODIO_DE_TESTE, { now: new Date('2026-10-01T12:00:00.000Z') });
      const antes = ledgerRowCount();

      await runSimulatedEpisode(EPISODIO_DE_TESTE, { now: new Date('2026-10-01T12:10:00.000Z') });

      expect(ledgerRowCount()).toBe(antes);
      const { header, rows } = readLedger();
      const custoIndex = header.indexOf('custo_usd');
      // Custo 0 gravado como 0.000000 (não célula vazia: vazio significa "não verificado").
      expect(rows.every((row) => row[custoIndex] === '0.000000')).toBe(true);
      expect(rows.every((row) => (row[header.indexOf('prompt_id')] ?? '').includes('simulado'))).toBe(true);
    },
    TIMEOUT,
  );
});

/**
 * O portão de fornecedor no caminho de vídeo.
 *
 * Contexto: o dono pediu para usar o gerador de vídeo do Google (Gemini Omni) no canal infantil. A
 * allow-list do canal marca `google` como `PROIBIDO` por cláusula literal dos *Gemini API Additional
 * Terms* ("Age Requirements"). O que estava errado não era a resposta — era o fato de que, se alguém
 * trocasse o provedor de vídeo, **nada perguntaria**: o portão existia desde o gerador de thumbnail e
 * protegia só aquela rota. Estes testes fixam o portão onde o dinheiro está (~96% do custo do episódio).
 *
 * Os dois primeiros rodam **sem ffmpeg** de propósito: o portão de fornecedor vem antes de
 * `assertFfmpegAvailable()`, e um teste que só passa em máquina com o binário instalado mede a máquina,
 * não o produto.
 */
describe('portão de fornecedor no caminho de vídeo (allow-list do canal)', () => {
  it('recusa fornecedor PROIBIDO antes de escrever qualquer arquivo — o caso do vídeo do Google', async () => {
    const { runSimulatedEpisode } = await import('../../../server/media/simulated-episode.js');
    const { SIMULATED_PROVIDERS } = await import('../../../server/media/providers/simulated.js');
    const { ProviderNotAllowedError } = await import('../../../server/media/allow-list.js');

    escreverAllowList([
      ...ALLOW_LIST_F0.filter((entrada) => entrada['fornecedor'] !== 'simulado-animacao'),
      {
        ...entradaSimulada('google', '*', '*'),
        status: 'PROIBIDO',
        fundamento: 'Age Requirements veda usar os serviços em aplicação dirigida a menores de 18',
        fonteUrl: 'https://ai.google.dev/gemini-api/terms',
      },
    ]);

    const comVideoDoGoogle = {
      ...SIMULATED_PROVIDERS,
      video: { ...SIMULATED_PROVIDERS.video, id: 'google', model: 'gemini-omni-1.1-flash' },
    };

    const linhasAntes = ledgerRowCount();
    let capturado: unknown = null;
    try {
      await runSimulatedEpisode(EPISODIO_DE_TESTE, {
        now: new Date('2026-10-01T12:00:00.000Z'),
        providers: comVideoDoGoogle,
      });
    } catch (error) {
      capturado = error;
    }

    expect(capturado).toBeInstanceOf(ProviderNotAllowedError);
    expect((capturado as { code?: string }).code).toBe('fornecedor-proibido');
    // A recusa tem de permitir DISCORDAR: sem o fundamento e a URL, o humano refaz a apuração inteira.
    expect(String((capturado as Error).message)).toContain('Age Requirements');
    expect(String((capturado as Error).message)).toContain('ai.google.dev/gemini-api/terms');

    // O que o portão existe para garantir: nada nasceu, nada foi cobrado.
    expect(ledgerRowCount()).toBe(linhasAntes);
    expect(existsSync(join(tempDir, 'assets', 'luna', 'luna-ep-teste'))).toBe(false);
  }, TIMEOUT);

  it('recusa quando o canal não tem allow-list — "não configurado" não pode significar "liberado"', async () => {
    const { runSimulatedEpisode } = await import('../../../server/media/simulated-episode.js');

    rmSync(join(tempDir, '.rebeca', 'canais', 'luna', 'allow-list.json'), { force: true });

    const linhasAntes = ledgerRowCount();
    let capturado: unknown = null;
    try {
      await runSimulatedEpisode(EPISODIO_DE_TESTE, { now: new Date('2026-10-01T12:00:00.000Z') });
    } catch (error) {
      capturado = error;
    }

    expect((capturado as { code?: string }).code).toBe('lista-ausente');
    expect(ledgerRowCount()).toBe(linhasAntes);
    expect(existsSync(join(tempDir, 'assets', 'luna', 'luna-ep-teste'))).toBe(false);
  }, TIMEOUT);

  it.skipIf(!HAS_FFMPEG)(
    'o portão roda mesmo com o cache quente — reexecução não é passe livre',
    async () => {
      /*
       * Este é o teste que refuta a saída fácil: "se tudo foi reusado, nada foi gerado, então não
       * precisa checar". O portão é de política, não de gasto — e a reexecução é o caminho mais comum
       * do pipeline. Um portão que se desliga quando o cache acerta some exatamente aí.
       */
      const { runSimulatedEpisode } = await import('../../../server/media/simulated-episode.js');

      const primeira = await runSimulatedEpisode(EPISODIO_DE_TESTE, {
        now: new Date('2026-10-01T12:00:00.000Z'),
      });
      expect(primeira.created).toBeGreaterThan(0);

      // O fornecedor de vídeo passa a estar vedado no canal, **depois** de já ter gerado.
      escreverAllowList([
        ...ALLOW_LIST_F0.filter((entrada) => entrada['fornecedor'] !== 'simulado-animacao'),
        {
          ...entradaSimulada('simulado-animacao', 'ffmpeg-zoompan-1', 'animacao'),
          status: 'PROIBIDO',
          fundamento: 'vedado depois da primeira execução',
        },
      ]);

      // Nenhum ativo precisa ser gerado — mas a resposta continua sendo não.
      await expect(
        runSimulatedEpisode(EPISODIO_DE_TESTE, { now: new Date('2026-10-01T12:05:00.000Z') }),
      ).rejects.toThrow(/PROIBIDO/);
    },
    TIMEOUT,
  );
});
