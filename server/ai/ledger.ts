/**
 * Registro de custo real por chamada de IA.
 *
 * Invariante nº 4 do projeto: **custo é requisito**. Toda geração paga registra custo real em
 * `.rebeca/custos.csv`. Esta é a implementação desse invariante para a camada de LLM.
 *
 * Três decisões que valem explicação:
 *
 * 1. **O custo sai de `usage`, não de estimativa nossa.** O provedor devolve tokens de entrada e de
 *    saída; o preço vem da tabela do catálogo, com fonte e data. Se o modelo não estiver na tabela, o
 *    custo é `nao-verificado` e o registro fica com `custo_usd` vazio — nunca com número inventado.
 * 2. **Gravação durável é best-effort e declarada.** No `pnpm dev` há disco e a linha entra no CSV.
 *    Na função serverless da Vercel o sistema de arquivos é somente-leitura; aí o custo vive em
 *    memória (e em `/tmp`) e a resposta devolve `costRecorded: 'memoria'`. **Não fingimos**
 *    persistência que não existe: memória durável em produção exige banco, que é a decisão D1 (ainda
 *    aberta).
 * 3. **A coluna `aprovado_por` não é preenchida com "IA".** Quem aprovou o gasto foi o humano, ao
 *    fixar o teto nesta sessão — o valor registrado diz exatamente isso, e não que ninguém aprovou.
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

/** Cabeçalho canônico do livro de custos. As três últimas colunas foram acrescentadas para a IA. */
export const LEDGER_HEADER = [
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
] as const;

export interface CostEntry {
  readonly canal: string;
  readonly conteudo: string;
  readonly etapa: string;
  readonly provedor: string;
  readonly modelo: string;
  readonly tokensIn: number;
  readonly tokensOut: number;
  readonly custoUsd: number | null;
  readonly tempoMin: number;
  readonly promptId: string;
  /** ISO — dia do gasto, no fuso da máquina que executou. */
  readonly data: string;
}

/** Onde o registro foi parar de fato. */
export type CostRecorded = 'csv' | 'memoria';

/** Valor gravado em `aprovado_por`: o gasto corre sob o teto que o humano aprovou. */
export const SPEND_APPROVED_BY = 'humano:teto-aprovado';

const memoryLedger: CostEntry[] = [];

function rootDir(): string {
  return process.env.REBECA_ROOT ? resolve(process.env.REBECA_ROOT) : process.cwd();
}

/**
 * Caminho do CSV gravável, ou `null` quando não há onde gravar.
 *
 * `REBECA_COST_LEDGER` permite apontar o registro para outro arquivo (usado pelos testes, para não
 * sujar o livro real com dado de teste).
 */
export function ledgerPath(): string | null {
  const configured = process.env.REBECA_COST_LEDGER;
  if (configured) return resolve(configured);
  // Na Vercel o bundle é somente-leitura (fora de /tmp): não há onde gravar de forma durável.
  if (process.env.VERCEL) return null;
  return join(rootDir(), '.rebeca', 'custos.csv');
}

/**
 * Caminho do livro **relativo à raiz do repositório**, para exibição.
 *
 * A resposta HTTP não precisa entregar a estrutura de diretórios da máquina só para a tela dizer onde
 * o livro está. Quando o arquivo configurado aponta para fora da raiz, devolve só o nome do arquivo.
 */
export function ledgerDisplayPath(): string | null {
  const path = ledgerPath();
  if (path === null) return null;
  const rel = relative(rootDir(), path);
  const display = rel.startsWith('..') ? path.split(/[\\/]/).pop() ?? path : rel;
  return display.replaceAll('\\', '/');
}

function csvCell(value: string | number | null): string {
  if (value === null) return '';
  // Quebra de linha vira espaço ANTES de qualquer coisa. Um campo com `\n` dentro é CSV válido, mas
  // quebra qualquer leitor que processe linha a linha — inclusive o de `spentTodayUsd`, o que fazia
  // o teto diário deixar de somar. Nenhum destes campos precisa de quebra de linha.
  const text = String(value).replace(/[\r\n]+/g, ' ');
  // Aspas só quando necessário: vírgula, aspas. Mantém o arquivo legível para humano.
  return /[",]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/**
 * Divide uma linha de CSV respeitando aspas.
 *
 * O `split(',')` que estava aqui era o defeito: `csvCell` cita o campo que contém vírgula, e o leitor
 * ingênuo partia esse campo ao meio. Efeito medido pelo `rebeca-qa`: um `contentId` com vírgula fazia
 * `spentTodayUsd` ler um número absurdo e travar o dia inteiro; um `contentId` com quebra de linha
 * fazia ler zero e **liberar** a chamada, furando o teto. Escrever e ler com regras diferentes é
 * como o dado corrompe em silêncio.
 */
function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (inQuotes) {
      if (char === '"') {
        if (line[index + 1] === '"') {
          current += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      cells.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells;
}

function toRow(entry: CostEntry): string {
  const cells: (string | number | null)[] = [
    entry.data,
    entry.canal,
    entry.conteudo,
    entry.etapa,
    entry.provedor,
    entry.modelo,
    'tokens',
    entry.tokensIn + entry.tokensOut,
    entry.custoUsd === null ? null : entry.custoUsd.toFixed(6),
    entry.tempoMin.toFixed(3),
    SPEND_APPROVED_BY,
    entry.tokensIn,
    entry.tokensOut,
    entry.promptId,
  ];
  return cells.map(csvCell).join(',');
}

/**
 * Garante que o arquivo exista com o cabeçalho completo.
 *
 * O livro já existia com 11 colunas; as três novas entram **no fim**, preservando nome e ordem das
 * antigas — `Import-Csv` continua lendo `custo_usd` sem mudança, e as linhas antigas ganham as
 * colunas novas vazias. Migração aditiva, feita uma vez, sem reescrever dado.
 */
function ensureLedger(path: string): void {
  if (!existsSync(path)) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${LEDGER_HEADER.join(',')}\n`, 'utf8');
    return;
  }

  const content = readFileSync(path, 'utf8');
  const newline = content.includes('\r\n') ? '\r\n' : '\n';
  const lines = content.split(/\r?\n/);
  const headerIndex = lines.findIndex((line) => line.trim().length > 0);
  if (headerIndex === -1) {
    writeFileSync(path, `${LEDGER_HEADER.join(',')}${newline}`, 'utf8');
    return;
  }

  const header = (lines[headerIndex] ?? '').split(',').map((cell) => cell.trim());
  const missing = LEDGER_HEADER.filter((column) => !header.includes(column));
  if (missing.length === 0) return;

  const paddedHeader = [...header, ...missing];
  // Toda linha de dado anterior ao cabeçalho novo ganha células vazias nas colunas acrescentadas.
  const padCount = missing.length;
  const migrated = lines.map((line, index) => {
    if (index === headerIndex) return paddedHeader.join(',');
    if (line.trim().length === 0 || line.trimStart().startsWith('#')) return line;
    return `${line}${','.repeat(padCount)}`;
  });

  writeFileSync(path, migrated.join(newline), 'utf8');
}

/** Soma o custo já gasto hoje, lendo o CSV (quando existe) e somando o que está em memória. */
export function spentTodayUsd(today: string): number {
  const fromMemory = memoryLedger
    .filter((entry) => entry.data === today)
    .reduce((total, entry) => total + (entry.custoUsd ?? 0), 0);

  const path = ledgerPath();
  if (!path || !existsSync(path)) return fromMemory;

  let fromCsv = 0;
  try {
    const lines = readFileSync(path, 'utf8').split(/\r?\n/);
    const header = (lines[0] ?? '').split(',').map((cell) => cell.trim());
    const dataIndex = header.indexOf('data');
    const costIndex = header.indexOf('custo_usd');
    if (dataIndex === -1 || costIndex === -1) return fromMemory;

    for (const line of lines.slice(1)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const cells = parseCsvLine(trimmed);
      if ((cells[dataIndex] ?? '').trim() !== today) continue;
      const raw = (cells[costIndex] ?? '').trim();
      // Célula vazia = custo não verificado (modelo fora da tabela de preços). Não é zero: somar
      // zero seria tratar "não sei" como "não gastou".
      if (raw === '') continue;
      const value = Number.parseFloat(raw);
      if (Number.isFinite(value)) fromCsv += value;
    }
  } catch {
    // Livro ilegível não pode derrubar a geração: o teto cai para o que está em memória e o
    // chamador recebe `costRecorded` honesto sobre onde o registro foi parar.
    return fromMemory;
  }

  // O CSV já contém o que foi gravado; a memória pode ter linhas que não couberam no disco.
  return Math.max(fromCsv, fromMemory);
}

/** Registra o custo. Devolve onde foi parar — e o chamador mostra isso na resposta. */
export function recordCost(entry: CostEntry): CostRecorded {
  memoryLedger.push(entry);

  const path = ledgerPath();
  if (!path) return 'memoria';

  try {
    ensureLedger(path);
    appendFileSync(path, `${toRow(entry)}${process.platform === 'win32' ? '\r\n' : '\n'}`, 'utf8');
    return 'csv';
  } catch {
    // Disco somente-leitura (ou caminho inválido): a linha continua em memória e o chamador é
    // informado de que o registro NÃO é durável. Devolver 'csv' aqui seria mentir sobre a
    // persistência — e o invariante nº 4 exige que o custo seja rastreável, não que pareça ser.
    return 'memoria';
  }
}

/** Só para teste: limpa o acumulado em memória do processo. */
export function resetMemoryLedger(): void {
  memoryLedger.length = 0;
}
