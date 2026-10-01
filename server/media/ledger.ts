/**
 * Livro de custos do pipeline de mídia.
 *
 * **Não existe CSV próprio.** O projeto tem um livro só — `.rebeca/custos.csv` — e as três últimas
 * colunas dele foram acrescentadas justamente para que a IA pudesse registrar o que gastou. Escrever um
 * segundo arquivo aqui faria a pergunta central do negócio ("esse conteúdo valeu a pena?") precisar de
 * duas consultas e de um join mental. Então este módulo **reusa `recordCost`** da camada de IA.
 *
 * Adaptação declarada, não escondida: `recordCost` grava `unidade` e `quantidade` como
 * `tokens`/`tokensIn+tokensOut` — colunas fixas na implementação. Um ativo de mídia não tem tokens. A
 * linha entra, portanto, com **0 tokens e custo real** (que na Fase 0 é `0.000000`, porque ffmpeg local
 * custa zero), e a identidade do ativo (etapa, versão de prompt, hash, duração, se é simulado) vai para
 * `prompt_id`, que é campo de texto livre. Isso é uma **limitação conhecida do cabeçalho atual**; o
 * `rebeca-backend` já registrou o conflito aberto do schema canônico de custo (`source`, `job_id`,
 * `unit_cost_usd`). Corrigir de verdade exige aquele ADR — não um `appendFileSync` paralelo aqui.
 *
 * Custo `0` é **verdade**, não ausência de dado: célula vazia é que significa "não verificado" (modelo
 * fora da tabela de preços). Os dois casos têm de continuar distinguíveis no arquivo.
 */

import { existsSync, readFileSync } from 'node:fs';
import { recordCost, ledgerPath, type CostRecorded } from '../ai/ledger.js';
import type { MediaStage } from '../../src/media/contract.js';
import {
  assertMonthlyWithinBudget,
  MediaBudgetError,
  type MediaLimits,
} from '../../src/media/limits.js';

/**
 * Onde o livro está de fato.
 *
 * Reexportado para que o resto do módulo de mídia dependa **deste** arquivo, e não de `server/ai/ledger`
 * diretamente: assim a fronteira entre as duas camadas continua sendo só o `recordCost`/`ledgerPath`, e a
 * limpeza do cabeçalho (ADR do schema canônico de custo) tem um único ponto para mudar.
 */
export { ledgerPath };

/** Data local no formato do livro (`YYYY-MM-DD`), igual ao que a camada de IA grava. */
export function todayLocal(now: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Chave do mês (`YYYY-MM`) — é o recorte do limite mensal D5. */
export function monthKey(now: Date): string {
  return todayLocal(now).slice(0, 7);
}

export interface AssetCostInput {
  readonly channelId: string;
  /** Nome de exibição do canal. O livro já usa o nome nas linhas da IA; manter o mesmo valor é o que
   * permite somar as duas camadas por canal sem tradução. */
  readonly channelName?: string;
  readonly episodeId: string;
  readonly stage: MediaStage;
  readonly providerId: string;
  readonly model: string;
  readonly promptVersion: string;
  readonly hash8: string;
  /** Duração medida do arquivo gerado. Entra no `prompt_id`, não em `tempo_min`. */
  readonly durationMs: number;
  readonly costUsd: number;
  readonly simulated: boolean;
  /** Tempo de **geração** do ativo, em minutos. É o significado real de `tempo_min` no livro. */
  readonly tempoMin: number;
  readonly now?: Date;
}

export function recordAssetCost(input: AssetCostInput): CostRecorded {
  const now = input.now ?? new Date();
  if (!Number.isFinite(input.costUsd) || input.costUsd < 0) {
    throw new MediaBudgetError(
      'custo-invalido',
      `Custo inválido para "${input.stage}/${input.hash8}": ${String(input.costUsd)}. Nunca registre número inventado no livro.`,
    );
  }

  return recordCost({
    canal: input.channelName ?? input.channelId,
    conteudo: input.episodeId,
    etapa: input.stage,
    provedor: input.providerId,
    modelo: input.model,
    // 0 tokens é a verdade para mídia: quem consumiu tokens foi a camada de IA, não o ffmpeg.
    tokensIn: 0,
    tokensOut: 0,
    custoUsd: input.costUsd,
    tempoMin: input.tempoMin,
    promptId: `${input.stage}:${input.promptVersion}#${input.hash8}#${input.durationMs}ms#${input.simulated ? 'simulado' : 'real'}`,
    data: todayLocal(now),
  });
}

/* =============================================================================
   Leitura do livro — necessária para o portão mensal
   ============================================================================= */

/**
 * Divide linha de CSV respeitando aspas — mesma regra do leitor da camada de IA.
 *
 * Reimplementado aqui porque o de lá é privado e `server/ai/**` está fora da área desta tarefa. A regra
 * do projeto é não escrever CSV por conta própria; **ler** com a mesma semântica é o que mantém o
 * arquivo coerente: quem escreve com aspas e lê com `split(',')` corrompe dado em silêncio.
 */
export function parseCsvLine(line: string): string[] {
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
    if (char === '"') inQuotes = true;
    else if (char === ',') {
      cells.push(current);
      current = '';
    } else current += char;
  }

  cells.push(current);
  return cells;
}

export interface LedgerTable {
  /** O arquivo existia quando foi lido? */
  readonly exists: boolean;
  readonly header: readonly string[];
  readonly rows: readonly (readonly string[])[];
}

/**
 * Lê o livro inteiro. Linhas de comentário (`#`) e vazias saem fora, como o leitor da IA faz.
 *
 * Distinguir **"livro ausente"** de **"livro com schema errado"** é essencial aqui: ausente significa
 * "nada foi gasto ainda" (resposta legítima: 0), enquanto schema errado significa "não dá para somar".
 * Tratar os dois como zero desligaria o portão mensal em silêncio — o defeito exato que ele existe para
 * impedir.
 */
export function readLedger(): LedgerTable {
  const path = ledgerPath();
  if (path === null || !existsSync(path)) return { exists: false, header: [], rows: [] };

  const lines = readFileSync(path, 'utf8').split(/\r?\n/);
  const headerIndex = lines.findIndex((line) => line.trim().length > 0);
  if (headerIndex === -1) return { exists: true, header: [], rows: [] };

  const header = parseCsvLine(lines[headerIndex] ?? '').map((cell) => cell.trim());
  const rows: string[][] = [];
  for (const line of lines.slice(headerIndex + 1)) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith('#')) continue;
    rows.push(parseCsvLine(trimmed));
  }
  return { exists: true, header, rows };
}

/** Quantas linhas de **dado** o livro tem hoje. É a medida da prova de idempotência. */
export function ledgerRowCount(): number {
  return readLedger().rows.length;
}

/**
 * Gasto somado de um mês.
 *
 * Regras de leitura, todas deliberadas:
 * - célula **vazia** em `custo_usd` = custo não verificado (modelo fora da tabela de preços). Não soma
 *   zero: somar zero trataria "não sei" como "não gastou";
 * - célula **não numérica** = livro corrompido. **Lança**, em vez de ignorar em silêncio: este número
 *   alimenta o portão que impede gasto acima do limite, e um portão que engole erro não é portão;
 * - `canal` é filtro opcional; sem ele, soma o mês inteiro (o D5 é limite de **carteira**, não de canal —
 *   US$ 60/mês cobre o projeto, não cada canal separadamente).
 */
export function monthlySpendUsd(month: string, channelName?: string): number {
  const { exists, header, rows } = readLedger();
  // Livro ausente (ou sem nenhuma linha) = nada foi gasto ainda. Não é corrupção: é o estado inicial.
  if (!exists || header.length === 0) return 0;

  const dataIndex = header.indexOf('data');
  const costIndex = header.indexOf('custo_usd');
  const channelIndex = header.indexOf('canal');
  if (dataIndex === -1 || costIndex === -1) {
    // Livro sem as colunas do contrato não pode responder "quanto já gastei". Devolver 0 aqui liberaria
    // a geração paga sem teto aplicável — exatamente o defeito que o portão existe para impedir.
    throw new MediaBudgetError(
      'custo-invalido',
      `O livro de custos não tem as colunas esperadas ("data", "custo_usd"). Cabeçalho lido: ${header.join(',') || '(vazio)'}.`,
    );
  }

  let total = 0;
  for (const row of rows) {
    if ((row[dataIndex] ?? '').trim().slice(0, 7) !== month) continue;
    if (channelName !== undefined && channelIndex !== -1 && (row[channelIndex] ?? '').trim() !== channelName) continue;
    const raw = (row[costIndex] ?? '').trim();
    if (raw === '') continue;
    const value = Number.parseFloat(raw);
    if (!Number.isFinite(value)) {
      throw new MediaBudgetError(
        'custo-invalido',
        `Custo ilegível no livro ("${raw}") na linha: ${row.join(',')}. O limite mensal não pode ser aplicado com o livro corrompido.`,
      );
    }
    total += value;
  }
  return total;
}

/**
 * Gasto **do episódio**, lido do livro.
 *
 * É este número que alimenta o teto por minuto (D2), e não uma soma em memória: assim o valor comparado
 * com o teto é o mesmo que o negócio vai ler depois, inclusive quando parte dos ativos veio de execução
 * anterior. Soma em memória esqueceria justamente o que já foi pago antes — o pior erro possível aqui.
 */
export function episodeSpendUsd(episodeId: string, channelName?: string): number {
  const { exists, header, rows } = readLedger();
  if (!exists || header.length === 0) return 0;

  const contentIndex = header.indexOf('conteudo');
  const costIndex = header.indexOf('custo_usd');
  const channelIndex = header.indexOf('canal');
  if (contentIndex === -1 || costIndex === -1) {
    throw new MediaBudgetError(
      'custo-invalido',
      `O livro de custos não tem as colunas esperadas ("conteudo", "custo_usd"). Cabeçalho lido: ${header.join(',') || '(vazio)'}.`,
    );
  }

  let total = 0;
  for (const row of rows) {
    if ((row[contentIndex] ?? '').trim() !== episodeId) continue;
    if (channelName !== undefined && channelIndex !== -1 && (row[channelIndex] ?? '').trim() !== channelName) continue;
    const raw = (row[costIndex] ?? '').trim();
    if (raw === '') continue;
    const value = Number.parseFloat(raw);
    if (!Number.isFinite(value)) {
      throw new MediaBudgetError(
        'custo-invalido',
        `Custo ilegível no livro ("${raw}") na linha: ${row.join(',')}. O teto por minuto não pode ser aplicado com o livro corrompido.`,
      );
    }
    total += value;
  }
  return total;
}

/**
 * Portão (b) aplicado ao estado real do livro.
 *
 * Chamado **antes** de gerar (com a estimativa do provedor) e **depois** de registrar (com o gasto
 * efetivo). Nos dois momentos a pergunta é a mesma: o mês já estourado mais o que vem agora passa do
 * limite? Onde não há livro durável (`ledgerPath()` devolve `null`), o portão **recusa** em vez de
 * fingir que o gasto é zero — sem livro não existe soma, e "sem soma" não é "dentro do limite".
 */
export function assertMonthlyBudgetForNow(
  now: Date,
  estimateUsd = 0,
  limits?: MediaLimits,
): { readonly month: string; readonly spentUsd: number; readonly projectedUsd: number } {
  if (ledgerPath() === null) {
    throw new MediaBudgetError(
      'teto-mensal',
      'PARE — neste ambiente não há livro de custos durável, então o limite mensal (D5) não pode ser aplicado. ' +
        'Sem soma confiável do mês, geração paga fica indisponível aqui.',
    );
  }
  const month = monthKey(now);
  const spentUsd = monthlySpendUsd(month);
  const projectedUsd = assertMonthlyWithinBudget(
    limits === undefined ? { spentUsd, estimateUsd, month } : { spentUsd, estimateUsd, month, limits },
  );
  return { month, spentUsd, projectedUsd };
}
