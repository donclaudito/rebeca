/**
 * Custo **real** de um conteúdo, lido do livro — a rota que substitui o número inventado.
 *
 * O defeito que originou isto: a tela de Revisão mostrava, com o rótulo **"Custo real"**, o `costUsd`
 * do arquivo de **exemplo** (`src/data/mock/db.ts`). Para `luna-borboletas` isso dava **US$ 42,80**,
 * enquanto o livro de custos somava **US$ 0,3956** — 108× de diferença, com cara de evidência, na tela em
 * que a decisão é humana.
 *
 * O que se testa aqui:
 *
 * 1. **A soma é a do livro**, filtrada por conteúdo **e** canal — e não a do dado de exemplo.
 * 2. **"Não sei" ≠ "gastei zero".** Livro ausente no ambiente devolve `ledgerAvailable: false` com
 *    motivo; devolver zero ali trocaria um número inventado por outro.
 * 3. **Célula vazia não vira zero.** "Custo não verificado" tem de **lançar** — é a regra que o
 *    `rebeca-qa` já derrubou uma vez, quando a célula vazia era pulada e o teto passava.
 * 4. **Sem spec de mídia não dá para filtrar**: o livro identifica o canal pelo **nome de exibição**, e
 *    a resposta é "não sei", nunca a soma do canal errado.
 *
 * Tudo em `REBECA_ROOT` temporário: a suíte não pode ler nem escrever o livro de produção.
 */

import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { contentSpend } from '../../../server/media/ledger.js';
import { routeMediaRequest } from '../../../server/media/http.js';
import {
  autenticacaoDeTeste,
  CLIENT_ID_DE_TESTE,
  isolarAmbiente,
  SUB_AUTORIZADO,
} from '@/auth/__tests__/test-support';

const CANAL = 'luna';
const NOME = 'Luna e o Jardim das Cores';
const CONTEUDO = 'luna-borboletas';

const HEADER =
  'data,canal,conteudo,etapa,provedor,modelo,unidade,quantidade,custo_usd,tempo_min,aprovado_por,tokens_in,tokens_out,prompt_id';

let tempDir = '';
let restaurarAmbiente: () => void = () => {};

/**
 * Toda rota de mídia passa pela guarda de identidade (`ADR-014`), que **falha fechada**: sem
 * `GOOGLE_CLIENT_ID` ela responde **503** e sem `REBECA_ALLOWED_SUBS` ninguém está autorizado. Sem os
 * dois, esta suíte mediria a guarda em vez da rota — e o teste que passasse estaria medindo a coisa
 * errada. O verificador é injetado (apoio da própria camada de autenticação), então nenhum teste toca a
 * rede nem depende de credencial real.
 */
const AUTH = autenticacaoDeTeste();

/** Atalho para a rota de custo, já autenticada. */
function chamarCusto(params: Record<string, string>) {
  return routeMediaRequest('GET', '/api/media/custos', new URLSearchParams(params), undefined, AUTH);
}

/** Escreve o livro de teste no `REBECA_COST_LEDGER` temporário. */
function escreverLivro(linhas: readonly string[]): void {
  writeFileSync(join(tempDir, 'custos.csv'), [HEADER, ...linhas].join('\n') + '\n', 'utf8');
}

/** Uma linha do livro, no formato real (o mesmo cabeçalho de `.rebeca/custos.csv`). */
function linha(input: {
  canal?: string;
  conteudo?: string;
  etapa?: string;
  custo: string;
}): string {
  const canal = input.canal ?? NOME;
  const conteudo = input.conteudo ?? CONTEUDO;
  const etapa = input.etapa ?? 'criar';
  return `2026-10-01,"${canal}",${conteudo},${etapa},openai,gpt-6-luna,tokens,1000,${input.custo},0.5,,900,120,criar-seo@v1`;
}

/** A spec de mídia **real** do canal: é dela que sai o nome usado no filtro do livro. */
function copiarSpec(): void {
  const origem = join(process.cwd(), '.rebeca', 'canais', CANAL, 'spec-midia.json');
  expect(existsSync(origem), `sem spec de mídia real em ${origem}`).toBe(true);
  const destino = join(tempDir, '.rebeca', 'canais', CANAL, 'spec-midia.json');
  mkdirSync(dirname(destino), { recursive: true });
  copyFileSync(origem, destino);
}

beforeEach(() => {
  restaurarAmbiente = isolarAmbiente();
  process.env['GOOGLE_CLIENT_ID'] = CLIENT_ID_DE_TESTE;
  process.env['REBECA_ALLOWED_SUBS'] = SUB_AUTORIZADO;

  tempDir = mkdtempSync(join(tmpdir(), 'rebeca-custos-'));
  process.env['REBECA_ROOT'] = tempDir;
  process.env['REBECA_COST_LEDGER'] = join(tempDir, 'custos.csv');
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
  delete process.env['REBECA_ROOT'];
  delete process.env['REBECA_COST_LEDGER'];
  restaurarAmbiente();
});

describe('contentSpend — a soma que vem do livro', () => {
  it('soma só o conteúdo pedido e separa por etapa', () => {
    escreverLivro([
      linha({ custo: '0.000227', etapa: 'criar' }),
      linha({ custo: '0.003500', etapa: 'thumbnail' }),
      // Outro conteúdo do MESMO canal: não pode entrar na conta.
      linha({ conteudo: 'luna-cachorro', custo: '9.990000' }),
      // O MESMO conteúdo em OUTRO canal: também não.
      linha({ canal: 'Arquivo Morto', custo: '7.770000' }),
    ]);

    const gasto = contentSpend(NOME, CONTEUDO);

    expect(gasto.ledgerAvailable).toBe(true);
    expect(gasto.rows).toBe(2);
    expect(gasto.totalUsd).toBeCloseTo(0.003727, 9);
    expect(gasto.byStage.map((etapa) => etapa.etapa)).toEqual(['thumbnail', 'criar']);
    expect(gasto.byStage[0]?.usd).toBeCloseTo(0.0035, 9);
  });

  it('livro ausente é "não sei", não "gastei zero"', () => {
    // `REBECA_COST_LEDGER` aponta para um arquivo que ninguém criou.
    const gasto = contentSpend(NOME, CONTEUDO);

    expect(gasto.ledgerAvailable).toBe(false);
    expect(gasto.rows).toBe(0);
  });

  it('célula de custo vazia LANÇA em vez de virar zero', () => {
    // A regra que o `rebeca-qa` derrubou uma vez: célula vazia pulada fazia "não sei" entrar como
    // "não gastou", e o teto passava com o gasto real escondido.
    escreverLivro([linha({ custo: '' })]);

    expect(() => contentSpend(NOME, CONTEUDO)).toThrow(/não verificado/i);
  });

  it('livro sem as colunas do contrato lança em vez de responder zero', () => {
    writeFileSync(join(tempDir, 'custos.csv'), 'data,canal,valor\n2026-10-01,x,1\n', 'utf8');

    expect(() => contentSpend(NOME, CONTEUDO)).toThrow(/colunas esperadas/i);
  });
});

describe('GET /api/media/custos', () => {
  it('sem spec de mídia responde "não sei" com motivo — nunca a soma do canal errado', async () => {
    escreverLivro([linha({ custo: '0.000227' })]);

    const resposta = await chamarCusto({ channelId: CANAL, contentId: CONTEUDO });

    expect(resposta.status).toBe(200);
    const body = resposta.body as { ledgerAvailable: boolean; totalUsd: number; motivo?: string };
    expect(body.ledgerAvailable).toBe(false);
    expect(body.totalUsd).toBe(0);
    expect(body.motivo).toContain('spec de mídia');
  });

  it('com a spec real do canal, devolve o total do livro e a origem do número', async () => {
    copiarSpec();
    escreverLivro([
      linha({ custo: '0.000227', etapa: 'criar' }),
      linha({ custo: '0.003500', etapa: 'thumbnail' }),
    ]);

    const resposta = await chamarCusto({ channelId: CANAL, contentId: CONTEUDO });

    expect(resposta.status).toBe(200);
    const body = resposta.body as {
      channelName: string | null;
      ledgerAvailable: boolean;
      totalUsd: number;
      rows: number;
      byStage: ReadonlyArray<{ etapa: string; usd: number }>;
    };
    expect(body.ledgerAvailable).toBe(true);
    expect(body.channelName).toBe(NOME);
    expect(body.totalUsd).toBeCloseTo(0.003727, 9);
    expect(body.rows).toBe(2);
    expect(body.byStage).toHaveLength(2);
  });

  it('conteúdo sem nenhuma linha é um zero verdadeiro, não um erro', async () => {
    copiarSpec();
    escreverLivro([linha({ conteudo: 'luna-cachorro', custo: '1.000000' })]);

    const resposta = await chamarCusto({ channelId: CANAL, contentId: CONTEUDO });

    expect(resposta.status).toBe(200);
    const body = resposta.body as { ledgerAvailable: boolean; rows: number; totalUsd: number };
    expect(body.ledgerAvailable).toBe(true);
    expect(body.rows).toBe(0);
    expect(body.totalUsd).toBe(0);
  });

  it('sem contentId recusa com 400 — não existe custo de "todos os conteúdos"', async () => {
    const resposta = await chamarCusto({ channelId: CANAL });

    expect(resposta.status).toBe(400);
    expect((resposta.body as { code?: string }).code).toBe('conteudo-obrigatorio');
  });

  it('sem channelId recusa com 400 — leitura de custo é sempre escopada por canal', async () => {
    const resposta = await chamarCusto({ contentId: CONTEUDO });

    expect(resposta.status).toBe(400);
    expect((resposta.body as { code?: string }).code).toBe('canal-obrigatorio');
  });
});
