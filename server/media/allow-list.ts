/**
 * Allow-list de provedores por canal — **dado versionado, não opinião de agente**.
 *
 * O `ADR-005` (aceito) decidiu que a allow-list é chaveada por `(fornecedor, modelo, finalidade, origem)`
 * e que "provedor sem termo lido = fora da lista, com URL, data de leitura, trecho citado e aprovador
 * registrados como dado versionado". Isso estava escrito no ADR e **não existia como arquivo** — a regra
 * morava só em prosa, e ninguém conseguia executá-la. Este módulo é a regra virando código.
 *
 * Três decisões que valem explicação:
 *
 * 1. **Só `PERMITIDO` passa.** `PROIBIDO` recusa com o fundamento; `NAO-VERIFICADO` também recusa. É o
 *    default conservador do `ADR-005`: silêncio contratual não é permissão. A recusa acontece **antes**
 *    de qualquer chamada de rede.
 * 2. **O gate é por canal.** O mesmo fornecedor pode ser permitido no canal adulto e proibido no
 *    infantil — isso é funcionalidade, não exceção (`ADR-005`, "Impacto em isolamento multi-canal").
 * 3. **O canal vem do caminho validado.** `assertSafeSegment` recusa `..`, barra e dois-pontos antes de
 *    o arquivo ser aberto (invariante nº 2).
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assertSafeSegment, repoRoot } from './paths.js';

export type ProviderStatus = 'PERMITIDO' | 'PROIBIDO' | 'NAO-VERIFICADO';

export interface AllowListEntry {
  readonly fornecedor: string;
  /** `*` casa qualquer modelo daquele fornecedor. */
  readonly modelo: string;
  /** `*` casa qualquer finalidade (`video`, `thumbnail`, `imagem`, …). */
  readonly finalidade: string;
  readonly status: ProviderStatus;
  readonly fundamento: string;
  readonly fonteUrl: string;
  readonly lidoEm: string;
  readonly aprovadoPor: string | null;
  readonly aprovadoEm: string | null;
  readonly ressalva?: string;
}

export interface AllowList {
  readonly canal: string;
  readonly nome: string;
  readonly publico: string;
  readonly atualizadoEm: string;
  readonly fonte: string;
  readonly regra: string;
  readonly entradas: readonly AllowListEntry[];
}

/**
 * Recusa de fornecedor.
 *
 * Tem `code` e mensagem em pt-BR porque **quem lê isto é o humano que decide** — e a mensagem precisa
 * dizer *qual documento* sustenta a recusa. "Provedor não permitido" sem o fundamento obriga a pessoa a
 * refazer toda a apuração para discordar.
 */
export class ProviderNotAllowedError extends Error {
  readonly code: 'fornecedor-nao-lista' | 'fornecedor-proibido' | 'fornecedor-nao-verificado' | 'lista-ausente';
  readonly entry: AllowListEntry | null;

  constructor(
    code: ProviderNotAllowedError['code'],
    message: string,
    entry: AllowListEntry | null = null,
  ) {
    super(message);
    this.name = 'ProviderNotAllowedError';
    this.code = code;
    this.entry = entry;
  }
}

export function allowListPath(channelId: string): string {
  return join(repoRoot(), '.rebeca', 'canais', assertSafeSegment(channelId, 'canal'), 'allow-list.json');
}

function isEntry(value: unknown): value is AllowListEntry {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record['fornecedor'] === 'string' &&
    typeof record['modelo'] === 'string' &&
    typeof record['finalidade'] === 'string' &&
    typeof record['status'] === 'string' &&
    typeof record['fundamento'] === 'string'
  );
}

/**
 * Lê a allow-list do canal.
 *
 * Arquivo ausente **não** vira lista vazia silenciosa: vira `null`, e quem chama decide. Lista vazia e
 * lista inexistente são coisas diferentes — a primeira significa "nada permitido", a segunda significa
 * "ninguém configurou isto ainda", e confundir as duas esconde um erro de instalação atrás de uma
 * mensagem de política.
 */
export function loadAllowList(channelId: string): AllowList | null {
  const path = allowListPath(channelId);
  if (!existsSync(path)) return null;

  const raw = JSON.parse(readFileSync(path, 'utf8')) as Partial<AllowList>;
  const entradas = Array.isArray(raw.entradas) ? raw.entradas.filter(isEntry) : [];
  return {
    canal: raw.canal ?? channelId,
    nome: raw.nome ?? channelId,
    publico: raw.publico ?? 'nao-declarado',
    atualizadoEm: raw.atualizadoEm ?? '',
    fonte: raw.fonte ?? '',
    regra: raw.regra ?? '',
    entradas,
  };
}

/** `*` casa qualquer valor; fora isso, igualdade exata (case-insensitive). */
function matches(pattern: string, value: string): boolean {
  return pattern === '*' || pattern.toLowerCase() === value.toLowerCase();
}

/** A entrada mais específica que casa: modelo exato antes de `*`, finalidade exata antes de `*`. */
function findEntry(
  list: AllowList,
  provider: string,
  model: string,
  purpose: string,
): AllowListEntry | null {
  const candidatas = list.entradas.filter(
    (entry) =>
      matches(entry.fornecedor, provider) && matches(entry.modelo, model) && matches(entry.finalidade, purpose),
  );
  if (candidatas.length === 0) return null;

  const score = (entry: AllowListEntry) =>
    (entry.modelo === '*' ? 0 : 1) + (entry.finalidade === '*' ? 0 : 1);
  return [...candidatas].sort((a, b) => score(b) - score(a))[0] ?? null;
}

/**
 * O fornecedor pode gerar isto, neste canal?
 *
 * Devolve a entrada que autorizou, ou **lança**. Devolver `false` em vez de lançar deixaria a decisão a
 * cargo de cada chamador — e basta um esquecer de checar para a política virar decoração.
 */
export function assertProviderAllowed(input: {
  readonly channelId: string;
  readonly provider: string;
  readonly model: string;
  readonly purpose: string;
}): AllowListEntry {
  const list = loadAllowList(input.channelId);

  if (list === null) {
    throw new ProviderNotAllowedError(
      'lista-ausente',
      `Não existe allow-list para o canal "${input.channelId}" (${allowListPath(input.channelId)}). ` +
        'Sem lista não há fornecedor autorizado — provedor sem termo lido fica fora, e "não configurado" ' +
        'não pode significar "liberado".',
    );
  }

  const entry = findEntry(list, input.provider, input.model, input.purpose);

  if (entry === null) {
    throw new ProviderNotAllowedError(
      'fornecedor-nao-lista',
      `O fornecedor "${input.provider}" / modelo "${input.model}" não está na allow-list do canal ` +
        `"${input.channelId}" para a finalidade "${input.purpose}". Nenhuma chamada foi feita. Para ` +
        'liberar, é preciso ler o termo oficial e acrescentar a entrada com fundamento, URL e data.',
    );
  }

  if (entry.status === 'PROIBIDO') {
    throw new ProviderNotAllowedError(
      'fornecedor-proibido',
      `RECUSADO — "${input.provider}" está marcado como PROIBIDO para o canal "${input.channelId}" ` +
        `(${input.purpose}). Fundamento: ${entry.fundamento} Fonte: ${entry.fonteUrl} (lido em ${entry.lidoEm}). ` +
        'Nada foi gerado e nada foi gasto.',
      entry,
    );
  }

  if (entry.status === 'NAO-VERIFICADO') {
    throw new ProviderNotAllowedError(
      'fornecedor-nao-verificado',
      `RECUSADO — "${input.provider}" está como NÃO VERIFICADO para o canal "${input.channelId}". ` +
        `Fundamento: ${entry.fundamento} O default é conservador de propósito: termo não lido não autoriza. ` +
        'Nada foi gerado e nada foi gasto.',
      entry,
    );
  }

  return entry;
}
