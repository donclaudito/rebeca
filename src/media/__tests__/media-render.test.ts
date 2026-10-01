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
 * - nenhum arquivo com nome não determinístico (`*final*`).
 *
 * Tudo em diretórios temporários (`REBECA_ASSETS_ROOT` e `REBECA_COST_LEDGER`): o teste gera vídeo de
 * verdade e não pode sujar a árvore de ativos nem o livro de custos do projeto.
 */

import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { EpisodeSpec } from '../../../server/media/simulated-episode.js';
import { ffmpegAvailable } from '../../../server/media/ffmpeg.js';
import { ledgerRowCount } from '../../../server/media/ledger.js';
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

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'rebeca-media-render-'));
  process.env['REBECA_COST_LEDGER'] = join(tempDir, 'custos.csv');
  process.env['REBECA_ASSETS_ROOT'] = join(tempDir, 'assets');
  resetMemoryLedger();
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
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

      const comProvedorPago = {
        ...SIMULATED_PROVIDERS,
        image: { ...SIMULATED_PROVIDERS.image, id: 'provedor-pago-fake', simulated: false },
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
