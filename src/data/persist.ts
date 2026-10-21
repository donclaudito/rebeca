/**
 * Persistência durável do estado que **custa dinheiro para produzir**.
 *
 * ## O defeito que este arquivo fecha
 *
 * Até aqui, tudo o que a IA gerava (roteiro, storyboard, aprovação, ficha de personagem) vivia só na
 * variável `store` de `src/data/client.ts` — memória do navegador. Recarregar a página (F5), fechar a
 * aba ou abrir em outra aba **apagava tudo**, inclusive o que já tinha sido pago. O relato do dono foi
 * exato: *"não permite salvar, tendo que refazer todo de novo, consumindo LLM no mesmo vídeo"*.
 *
 * O botão de gravar existia e funcionava (`saveRoteiro` → `patchArtifact` → `patchContent`); o que não
 * existia era **durabilidade**. Gravar em memória é gravar até o primeiro F5.
 *
 * ## Por que `localStorage`, e não o servidor
 *
 * O app publicado roda em serverless, onde o disco é somente leitura e efêmero
 * (`GET /api/ai/settings` responde `writable:false` nesse ambiente). Gravar no disco do servidor
 * funcionaria só em desenvolvimento e criaria **durabilidade falsa** em produção — pior que não ter.
 * A resposta certa é banco de dados, e essa é a decisão **D1** (stack de backend), que continua aberta
 * e não é deste arquivo. Enquanto ela não for tomada, `localStorage` é o que de fato sobrevive ao
 * reload nos dois ambientes.
 *
 * **Limite declarado, não escondido:** é durável **por navegador e por máquina**. Trocar de navegador,
 * limpar os dados do site ou usar outro computador perde o conteúdo. O app diz isso na tela em vez de
 * prometer sincronização que não existe.
 *
 * ## Isolamento entre canais (invariante nº 2)
 *
 * A chave é **por canal** (`…:conteudos:<channelId>`), nunca um blob único. Um bug de leitura não
 * consegue misturar canais porque um canal não alcança a chave do outro — o isolamento é estrutural,
 * não uma checagem que alguém pode esquecer de fazer.
 */

import type { ChannelId, Character, ContentItem } from './types';

/** Versão do formato gravado. Trocar o formato exige trocar isto (o registro antigo é ignorado). */
const VERSION = 'v1';
const PREFIX = `rebeca:${VERSION}`;

/** O que a tela precisa saber para não mentir sobre durabilidade. */
export interface Durability {
  /** `true` quando o que a IA gerou sobrevive a recarregar a página. */
  durable: boolean;
  /** Motivo em pt-BR quando não é durável. Vai para a tela — o usuário precisa saber **antes** de pagar. */
  reason?: string;
}

let cache: Durability | null = null;

function storage(): Storage | null {
  // Lido do global a cada chamada (e não capturado no topo): em teste, `vi.stubGlobal` troca o objeto.
  const local = (globalThis as { localStorage?: Storage }).localStorage;
  return local ?? null;
}

/**
 * Mede a durabilidade **de verdade** — escreve, lê de volta e confere. Não basta `localStorage`
 * existir: na janela privada do Safari ele existe e lança na gravação.
 */
function measure(): Durability {
  const local = storage();
  if (local === null) {
    return { durable: false, reason: 'este ambiente não tem armazenamento local' };
  }
  try {
    const probe = `${PREFIX}:sonda`;
    local.setItem(probe, '1');
    const readBack = local.getItem(probe);
    local.removeItem(probe);
    if (readBack !== '1') {
      return { durable: false, reason: 'o armazenamento local não devolveu o que foi gravado' };
    }
    return { durable: true };
  } catch {
    return {
      durable: false,
      reason: 'o navegador bloqueou o armazenamento local (janela privada ou cota cheia)',
    };
  }
}

/** Durabilidade medida uma vez por sessão de página. */
export function durability(): Durability {
  if (cache === null) cache = measure();
  return cache;
}

/** Zera a medição — usado pelo teste que força o modo sem armazenamento. */
export function _remeasureDurability(): Durability {
  cache = null;
  return durability();
}

const contentsKey = (channelId: ChannelId) => `${PREFIX}:conteudos:${channelId}`;
const charactersKey = (channelId: ChannelId) => `${PREFIX}:personagens:${channelId}`;

function read<T>(key: string, isValid: (item: unknown) => boolean): T[] | null {
  const local = storage();
  if (local === null) return null;
  let raw: string | null;
  try {
    raw = local.getItem(key);
  } catch {
    return null;
  }
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    // Item de forma inesperada é descartado, não propagado: dado corrompido não pode derrubar a tela.
    return parsed.filter(isValid) as T[];
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  const local = storage();
  if (local === null) return;
  try {
    local.setItem(key, JSON.stringify(value));
  } catch {
    // Cota cheia ou gravação bloqueada no meio da sessão: a durabilidade deixa de valer **agora**, e a
    // tela passa a avisar. Falhar em silêncio aqui é o que transforma perda de trabalho em surpresa.
    cache = { durable: false, reason: 'não foi possível gravar (armazenamento cheio ou bloqueado)' };
  }
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/** Validação mínima: o suficiente para não injetar lixo na lista. */
const isContentItem = (item: unknown): boolean =>
  isObject(item) && typeof item['id'] === 'string' && typeof item['channelId'] === 'string';

const isCharacter = (item: unknown): boolean =>
  isObject(item) && typeof item['id'] === 'string' && typeof item['channelId'] === 'string';

export function loadContents(channelId: ChannelId): ContentItem[] | null {
  return read<ContentItem>(contentsKey(channelId), isContentItem);
}

export function saveContents(channelId: ChannelId, items: ContentItem[]): void {
  write(contentsKey(channelId), items);
}

export function loadCharacters(channelId: ChannelId): Character[] | null {
  return read<Character>(charactersKey(channelId), isCharacter);
}

export function saveCharacters(channelId: ChannelId, items: Character[]): void {
  write(charactersKey(channelId), items);
}

/** Apaga **tudo** o que este módulo gravou. Usado pelo "reiniciar exemplo" e pelos testes. */
export function clearPersistence(): void {
  const local = storage();
  if (local === null) return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < local.length; i += 1) {
      const key = local.key(i);
      if (key !== null && key.startsWith(`${PREFIX}:`)) keys.push(key);
    }
    for (const key of keys) local.removeItem(key);
  } catch {
    // Sem acesso à listagem não há o que limpar; o `resetStore` continua funcionando em memória.
  }
  cache = null;
}
