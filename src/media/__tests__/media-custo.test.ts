/**
 * Custo: matemática, livro e idempotência.
 *
 * Três exigências do projeto são verificadas aqui, **sem ffmpeg**:
 *
 * 1. **Custo `0` é resposta, não ausência de dado.** Célula vazia significa "não verificado"; `0.000000`
 *    significa "não custou". Trocar os dois faz o painel de negócio decidir errado.
 * 2. **Portões de gasto (D2 por minuto, D5 por mês).** Exercitados com custo **injetado** — o provedor
 *    simulado custa zero, e inventar gasto real para "testar" seria falsificar o livro.
 * 3. **Idempotência.** Reexecutar o mesmo episódio não pode criar linha nova no livro nem arquivo novo. A
 *    prova aqui é no nível do manifesto (o do pipeline inteiro, com ffmpeg, está em `media-render.test.ts`).
 *
 * O livro é sempre temporário (`REBECA_COST_LEDGER`) e a raiz de ativos também (`REBECA_ASSETS_ROOT`): teste
 * não pode sujar o custo real nem a árvore de ativos de quem está rodando.
 */

import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { MediaAsset } from '../contract.js';
import {
  assertEpisodeWithinBudget,
  assertMonthlyWithinBudget,
  MEDIA_LIMITS,
  MediaBudgetError,
  usdPerMinute,
} from '../limits.js';
import {
  assertMonthlyBudgetForNow,
  ledgerPath,
  ledgerRowCount,
  monthlySpendUsd,
  readLedger,
  recordAssetCost,
} from '../../../server/media/ledger.js';
import {
  approveAsset,
  emptyManifest,
  findReusable,
  nextVersion,
  readManifest,
  upsertAssets,
  writeManifest,
} from '../../../server/media/manifest.js';
import { assetsRoot } from '../../../server/media/paths.js';
import { resetMemoryLedger } from '../../../server/ai/ledger.js';

const NOW = new Date('2026-10-01T12:00:00.000Z');
const MES = '2026-10';

let tempDir = '';
let ledgerFile = '';

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'rebeca-media-teste-'));
  ledgerFile = join(tempDir, 'custos.csv');
  process.env['REBECA_COST_LEDGER'] = ledgerFile;
  process.env['REBECA_ASSETS_ROOT'] = join(tempDir, 'assets');
  resetMemoryLedger();
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
  delete process.env['REBECA_COST_LEDGER'];
  delete process.env['REBECA_ASSETS_ROOT'];
  resetMemoryLedger();
});

function costRow(costUsd: number, overrides: Partial<Parameters<typeof recordAssetCost>[0]> = {}) {
  return recordAssetCost({
    channelId: 'luna',
    channelName: 'Luna e o Jardim das Cores',
    episodeId: 'luna-ep-001',
    stage: 'voz',
    providerId: 'simulado-voz',
    model: 'ffmpeg-tom-1',
    promptVersion: 'criar-cena@v1',
    hash8: 'deadbeef',
    durationMs: 3714,
    costUsd,
    simulated: true,
    tempoMin: 0.02,
    now: NOW,
    ...overrides,
  });
}

describe('matemática de custo por minuto', () => {
  it('custo 0 devolve 0 — e não NaN nem célula vazia', () => {
    const rate = usdPerMinute(0, 30_000);

    expect(rate).toBe(0);
    expect(Number.isFinite(rate)).toBe(true);
    expect(String(rate)).not.toBe('');
  });

  it('calcula a taxa a partir da duração do arquivo renderizado', () => {
    // 6 dólares em 30 s = 12 dólares por minuto.
    expect(usdPerMinute(6, 30_000)).toBeCloseTo(12, 10);
    expect(usdPerMinute(0.5, 60_000)).toBeCloseTo(0.5, 10);
  });

  it('recusa custo inventado e duração ausente em vez de devolver número falso', () => {
    expect(() => usdPerMinute(Number.NaN, 1000)).toThrowError(MediaBudgetError);
    expect(() => usdPerMinute(-1, 1000)).toThrowError(MediaBudgetError);
    expect(() => usdPerMinute(1, 0)).toThrowError(MediaBudgetError);
    expect(() => usdPerMinute(1, Number.NaN)).toThrowError(MediaBudgetError);
  });
});

describe('portão (a) — teto por minuto (D2)', () => {
  it('exatamente no teto passa; acima do teto para o pipeline', () => {
    expect(MEDIA_LIMITS.perMinuteUsd).toBe(12);

    expect(assertEpisodeWithinBudget({ costUsd: 12, durationMs: 60_000 })).toBeCloseTo(12, 10);
    expect(assertEpisodeWithinBudget({ costUsd: 6, durationMs: 30_000 })).toBeCloseTo(12, 10);

    try {
      assertEpisodeWithinBudget({ costUsd: 12.01, durationMs: 60_000 });
      throw new Error('deveria ter parado');
    } catch (error) {
      expect(error).toBeInstanceOf(MediaBudgetError);
      expect((error as MediaBudgetError).code).toBe('teto-por-minuto');
      expect((error as MediaBudgetError).message).toMatch(/PARE/);
      expect((error as MediaBudgetError).message).toMatch(/12/);
    }
  });

  it('um episódio de 7 min na Stack A (US$ 8,55/min) passa; um de US$ 70/min não', () => {
    expect(() => assertEpisodeWithinBudget({ costUsd: 8.55 * 7, durationMs: 420_000 })).not.toThrow();
    try {
      assertEpisodeWithinBudget({ costUsd: 70 * 7, durationMs: 420_000 });
      throw new Error('deveria ter parado');
    } catch (error) {
      // O portão tem código próprio — é ele que o pipeline e os testes leem, não o texto da mensagem.
      expect(error).toBeInstanceOf(MediaBudgetError);
      expect((error as MediaBudgetError).code).toBe('teto-por-minuto');
      expect((error as MediaBudgetError).message).toMatch(/acima do teto aprovado/);
    }
  });
});

describe('portão (b) — limite mensal (D5)', () => {
  it('gasto do mês mais a estimativa acima do limite para o pipeline', () => {
    expect(MEDIA_LIMITS.monthlyUsd).toBe(60);

    expect(assertMonthlyWithinBudget({ spentUsd: 59.99, estimateUsd: 0, month: MES })).toBeCloseTo(59.99, 6);
    expect(assertMonthlyWithinBudget({ spentUsd: 60, estimateUsd: 0, month: MES })).toBeCloseTo(60, 6);

    try {
      assertMonthlyWithinBudget({ spentUsd: 59.99, estimateUsd: 0.02, month: MES });
      throw new Error('deveria ter parado');
    } catch (error) {
      expect(error).toBeInstanceOf(MediaBudgetError);
      expect((error as MediaBudgetError).code).toBe('teto-mensal');
    }
  });

  it('lê o gasto do mês do livro, na coluna real custo_usd, e ignora outros meses', () => {
    costRow(1.5);
    costRow(2.25);
    costRow(100, { now: new Date('2026-09-30T12:00:00.000Z') });

    expect(monthlySpendUsd(MES)).toBeCloseTo(3.75, 6);
    expect(monthlySpendUsd('2026-09')).toBeCloseTo(100, 6);
    expect(monthlySpendUsd('2026-11')).toBe(0);
  });

  it('célula vazia de custo é "não verificado" e NÃO soma zero; célula ilegível para o pipeline', () => {
    costRow(1);
    // Linha como a camada de IA grava quando o modelo está fora da tabela de preços: custo vazio.
    // Escrita à mão de propósito — é a única forma de simular dado que `recordCost` não produz.
    const linhas = readFileSync(ledgerFile, 'utf8');
    writeFileSync(
      ledgerFile,
      `${linhas}2026-10-02,Luna e o Jardim das Cores,ep-x,criar,openai,modelo-fora-da-tabela,tokens,10,,0.000,humano:teto-aprovado,5,5,teste@v1\n`,
      'utf8',
    );
    expect(monthlySpendUsd(MES)).toBeCloseTo(1, 6);

    writeFileSync(
      ledgerFile,
      `${linhas}2026-10-03,Luna e o Jardim das Cores,ep-x,criar,openai,modelo,tokens,10,abc,0.000,humano:teto-aprovado,5,5,teste@v1\n`,
      'utf8',
    );
    expect(() => monthlySpendUsd(MES)).toThrowError(/ilegível/);
  });

  it('sem livro durável o portão recusa em vez de fingir gasto zero', () => {
    delete process.env['REBECA_COST_LEDGER'];
    process.env['VERCEL'] = '1';
    try {
      expect(ledgerPath()).toBeNull();
      expect(() => assertMonthlyBudgetForNow(NOW, 0)).toThrowError(/livro de custos durável/);
    } finally {
      delete process.env['VERCEL'];
    }
  });

  it('aplica o portão sobre o estado real do livro', () => {
    costRow(59.5);
    expect(assertMonthlyBudgetForNow(NOW, 0).spentUsd).toBeCloseTo(59.5, 6);
    expect(() => assertMonthlyBudgetForNow(NOW, 1)).toThrowError(MediaBudgetError);
  });
});

describe('registro de custo no livro real (.rebeca/custos.csv via recordCost)', () => {
  it('grava custo 0 como 0.000000, com o cabeçalho de verdade e a identidade do ativo', () => {
    costRow(0);

    const { header, rows } = readLedger();
    expect(header).toEqual([
      'data',
      'canal',
      'conteudo',
      'etapa',
      'provedor',
      'modelo',
      'unidade',
      'quantidade',
      'custo_usd',
      'tempo_min',
      'aprovado_por',
      'tokens_in',
      'tokens_out',
      'prompt_id',
    ]);
    expect(rows).toHaveLength(1);

    const row = rows[0] ?? [];
    expect(row[header.indexOf('data')]).toBe('2026-10-01');
    expect(row[header.indexOf('canal')]).toBe('Luna e o Jardim das Cores');
    expect(row[header.indexOf('conteudo')]).toBe('luna-ep-001');
    expect(row[header.indexOf('etapa')]).toBe('voz');
    expect(row[header.indexOf('provedor')]).toBe('simulado-voz');
    expect(row[header.indexOf('custo_usd')]).toBe('0.000000');
    expect(row[header.indexOf('tokens_in')]).toBe('0');
    expect(row[header.indexOf('tempo_min')]).toBe('0.020');
    // Identidade do ativo no campo de texto: o cabeçalho não tem coluna de hash nem de duração.
    expect(row[header.indexOf('prompt_id')]).toContain('voz:criar-cena@v1#deadbeef#3714ms#simulado');
  });

  it('recusa custo negativo ou não numérico antes de escrever qualquer linha', () => {
    expect(() => costRow(-0.01)).toThrowError(MediaBudgetError);
    expect(() => costRow(Number.NaN)).toThrowError(MediaBudgetError);
    expect(ledgerRowCount()).toBe(0);
  });
});

describe('idempotência (manifesto + livro)', () => {
  const ENTRY: MediaAsset = {
    channelId: 'luna',
    episodeId: 'luna-ep-001',
    stage: 'imagem',
    kind: 'imagem',
    key: 'cena-01',
    version: 1,
    path: 'luna/luna-ep-001/imagem/cena-01-deadbeef.png',
    pathFromAssets: 'luna/luna-ep-001/imagem/cena-01-deadbeef.png',
    hash: 'deadbeef',
    sha256: 'f'.repeat(64),
    durationMs: 0,
    bytes: 12,
    providerId: 'simulado-imagem',
    model: 'ffmpeg-lavfi-drawtext-1',
    promptVersion: 'criar-cena@v1',
    costUsd: 0,
    simulated: true,
    reference: 'sintetica',
    approved: false,
    recordedAt: NOW.toISOString(),
  };

  function episodeDirOf(): string {
    return join(assetsRoot(), 'luna', 'luna-ep-001', 'imagem');
  }

  /** Uma passada do pipeline sobre um ativo: reusa pelo manifesto ou gera e registra. */
  function pass(manifest: ReturnType<typeof emptyManifest>) {
    const reusable = findReusable(manifest, 'imagem', ENTRY.key, ENTRY.hash);
    if (reusable !== undefined) return { created: 0 };

    mkdirSync(episodeDirOf(), { recursive: true });
    writeFileSync(join(assetsRoot(), ENTRY.pathFromAssets), 'conteudo-do-png');
    costRow(0, { stage: 'imagem', providerId: ENTRY.providerId, model: ENTRY.model, hash8: ENTRY.hash, durationMs: 0 });
    return { created: 1 };
  }

  it('a segunda passada não cria linha nova no livro nem arquivo novo', () => {
    let manifest = emptyManifest('luna', 'luna-ep-001', 'luna-ep-001', NOW);

    expect(pass(manifest).created).toBe(1);
    expect(ledgerRowCount()).toBe(1);
    expect(existsSync(join(assetsRoot(), ENTRY.pathFromAssets))).toBe(true);

    manifest = upsertAssets(manifest, [ENTRY], NOW);

    expect(pass(manifest).created).toBe(0);
    expect(ledgerRowCount()).toBe(1); // ← a prova: nenhuma linha nova
    expect(existsSync(join(assetsRoot(), ENTRY.pathFromAssets))).toBe(true);
  });

  it('manifesto apontando para arquivo que sumiu não é motivo para pular a geração', () => {
    const manifest = upsertAssets(emptyManifest('luna', 'luna-ep-001', 'luna-ep-001', NOW), [ENTRY], NOW);

    // Sem o arquivo no disco, reusar entregaria caminho quebrado.
    expect(findReusable(manifest, 'imagem', ENTRY.key, ENTRY.hash)).toBeUndefined();
    expect(pass(manifest).created).toBe(1);
  });

  it('conteúdo novo depois de aprovado vira v2 — a versão aprovada nunca é sobrescrita', () => {
    let manifest = upsertAssets(emptyManifest('luna', 'luna-ep-001', 'luna-ep-001', NOW), [ENTRY], NOW);
    manifest = approveAsset(manifest, 'imagem', 'cena-01', 1, NOW);

    expect(nextVersion(manifest, 'imagem', 'cena-01', ENTRY.hash)).toBe(1);
    expect(nextVersion(manifest, 'imagem', 'cena-01', 'cafebabe')).toBe(2);

    manifest = upsertAssets(manifest, [{ ...ENTRY, hash: 'cafebabe', version: 2 }], NOW);
    const versoes = manifest.assets.filter((asset) => asset.stage === 'imagem' && asset.key === 'cena-01');

    expect(versoes).toHaveLength(2);
    expect(versoes.find((asset) => asset.version === 1)?.approved).toBe(true);
    expect(versoes.find((asset) => asset.version === 2)?.approved).toBe(false);
  });

  it('manifesto grava e lê o mesmo conteúdo, com os tetos em vigor registrados', () => {
    const manifest = emptyManifest('luna', 'luna-ep-001', 'luna-ep-001', NOW);
    const path = writeManifest(upsertAssets(manifest, [ENTRY], NOW), 'luna');
    const lido = readManifest('luna', 'luna', 'luna-ep-001');

    expect(existsSync(path)).toBe(true);
    expect(lido?.assets).toHaveLength(1);
    expect(lido?.limits.tetoPorMinutoUsd).toBe(MEDIA_LIMITS.perMinuteUsd);
    expect(lido?.limits.limiteMensalUsd).toBe(MEDIA_LIMITS.monthlyUsd);
    expect(lido?.limits.aprovadoPor).toBe(MEDIA_LIMITS.approvedBy);
    expect(lido?.referenciaVisual.tipo).toBe('sintetica');
    expect(readManifest('luna', 'luna', 'luna-ep-999')).toBeNull();
  });
});
