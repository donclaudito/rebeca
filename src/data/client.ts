/**
 * Camada de dados do cliente.
 *
 * Hoje ela lê de `src/data/mock/db.ts`. Amanhã ela chama a API real. **Nenhum componente sabe
 * disso** — é o contrato que o ADR-001 fixou.
 *
 * INVARIANTE: toda chave de cache começa por `['channel', channelId]`. Chave sem canal é bug de
 * isolamento (AGENTS.md, invariante nº 2) e o teste `src/data/__tests__/channel-scope.test.tsx`
 * existe para refutar isso.
 */

import type {
  ApprovalRecord,
  BrandKit,
  Cena,
  Channel,
  ChannelId,
  ChannelKpis,
  Character,
  CharacterProposal,
  CharacterSheet,
  CharacterSheetOrigin,
  ContentItem,
  ContentStatus,
  ModuleState,
  PortfolioRow,
  Recommendation,
  Roteiro,
  Storyboard,
  ThumbnailOption,
  TileTone,
  WeeklySlot,
} from './types';
import { channels, characters, contents, todayIso } from './mock/db';
import {
  brandKitFor,
  channelById,
  currentWeekDays,
  kpis,
  kpisFor,
  modulesFor,
  recommendationsFor,
} from './mock/db';
import {
  clearPersistence,
  loadCharacters,
  loadContents,
  saveCharacters,
  saveContents,
} from './persist';
import { toIsoDate } from '@/lib/date';

/* =============================================================================
   Chaves de cache — sempre escopadas por canal
   ============================================================================= */

export const qk = {
  channels: () => ['channels'] as const,
  channel: (channelId: ChannelId) => ['channel', channelId] as const,
  kpis: (channelId: ChannelId) => ['channel', channelId, 'kpis'] as const,
  contents: (channelId: ChannelId) => ['channel', channelId, 'contents'] as const,
  reviewQueue: (channelId: ChannelId) => ['channel', channelId, 'review-queue'] as const,
  content: (channelId: ChannelId, contentId: string) =>
    ['channel', channelId, 'content', contentId] as const,
  week: (channelId: ChannelId) => ['channel', channelId, 'week'] as const,
  modules: (channelId: ChannelId) => ['channel', channelId, 'modules'] as const,
  characters: (channelId: ChannelId) => ['channel', channelId, 'characters'] as const,
  brand: (channelId: ChannelId) => ['channel', channelId, 'brand'] as const,
  recommendations: (channelId: ChannelId) => ['channel', channelId, 'recommendations'] as const,
  portfolio: () => ['portfolio'] as const,
} as const;

/* =============================================================================
   Armazenamento mutável do protótipo
   ============================================================================= */

/**
 * Semente → `ContentItem`: a cópia mutável que aprovar/agendar "pega" durante a demonstração.
 *
 * `approval: null` é escrito aqui, e não em `mock/db.ts`, porque é a única forma de garantir que
 * **nenhum conteúdo nasce aprovado** — nem por descuido em dado de exemplo.
 */
function seedStore(): ContentItem[] {
  return contents.map((item) => ({
    ...item,
    seo: { ...item.seo, tags: [...item.seo.tags] },
    thumbnails: item.thumbnails.map((thumb) => ({ ...thumb })),
    approval: null,
  }));
}

/**
 * Semente **+ o que já foi gravado neste navegador**.
 *
 * Sem esta função, tudo o que a IA gerou (roteiro, cenas, aprovação, thumbnail escolhida) morria no
 * primeiro F5 — e gerar de novo custa de novo. Ver `src/data/persist.ts`, que explica por que a
 * durabilidade hoje é do navegador e não do servidor (a decisão de backend, D1, segue aberta).
 *
 * O canal é a unidade de leitura: para cada canal da semente, vale o que estiver gravado **daquele**
 * canal; sem gravação, vale a semente. Nunca se mistura canal com canal.
 */
function hydrateStore(): ContentItem[] {
  const seeded = seedStore();
  const channelIds: ChannelId[] = [];
  for (const item of seeded) {
    if (!channelIds.includes(item.channelId)) channelIds.push(item.channelId);
  }

  const hydrated: ContentItem[] = [];
  for (const channelId of channelIds) {
    const stored = loadContents(channelId);
    hydrated.push(
      ...(stored !== null && stored.length > 0
        ? stored
        : seeded.filter((item) => item.channelId === channelId)),
    );
  }
  return hydrated;
}

let store: ContentItem[] = hydrateStore();

/* -----------------------------------------------------------------------------
   Personagens: a cópia mutável do ciclo do personagem
   -----------------------------------------------------------------------------
   Mesma ideia do `store` acima, com uma diferença que importa: personagem **nasce** de proposta de IA,
   mas quem grava é sempre um clique humano. Enquanto a lista lia direto o dado de exemplo
   (`charactersFor`), não havia onde gravar escolha nenhuma — e as quatro batidas do PDF (opções →
   escolha → refino → aprovação) não tinham como acontecer.
   -------------------------------------------------------------------------- */

function seedCharacterStore(): Character[] {
  return characters.map((character) => ({
    ...character,
    sheet: { ...character.sheet, tracos: [...character.sheet.tracos] },
    sheetOrigin: { ...character.sheetOrigin },
  }));
}

/** Mesma ideia do `hydrateStore`, para o ciclo do personagem. */
function hydrateCharacterStore(): Character[] {
  const seeded = seedCharacterStore();
  const channelIds: ChannelId[] = [];
  for (const item of seeded) {
    if (!channelIds.includes(item.channelId)) channelIds.push(item.channelId);
  }

  const hydrated: Character[] = [];
  for (const channelId of channelIds) {
    const stored = loadCharacters(channelId);
    hydrated.push(
      ...(stored !== null && stored.length > 0
        ? stored
        : seeded.filter((item) => item.channelId === channelId)),
    );
  }
  return hydrated;
}

let characterStore: Character[] = hydrateCharacterStore();

/**
 * Restaura o estado de exemplo (usado por testes e pelo botão "reiniciar exemplo").
 *
 * Apaga também o que está gravado no navegador: "reiniciar" que deixasse a gravação antiga no disco
 * traria o estado de volta no próximo carregamento — o botão mentiria.
 */
export function resetStore(): void {
  clearPersistence();
  store = seedStore();
  characterStore = seedCharacterStore();
}

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function findContent(channelId: ChannelId, contentId: string): ContentItem {
  const found = store.find((item) => item.channelId === channelId && item.id === contentId);
  if (!found) {
    // Não vaza a existência do conteúdo de outro canal: a mensagem é a mesma para "não existe"
    // e "não é seu".
    throw new Error('Conteúdo não encontrado neste canal.');
  }
  return found;
}

/** Atualização crua, preservando o estado no ciclo. Uso interno e deliberado — ver `patchArtifact`. */
function patchContent(channelId: ChannelId, contentId: string, patch: Partial<ContentItem>): ContentItem {
  const current = findContent(channelId, contentId);
  const next: ContentItem = { ...current, ...patch };
  store = store.map((item) => (item === current ? next : item));
  // Grava **aqui**, no funil por onde passa toda mutação de conteúdo: um caminho novo de gravação que
  // esquecesse esta linha perderia trabalho pago ao recarregar, e é exatamente esse o defeito que o
  // `persist.ts` fecha. Só o canal afetado é reescrito.
  saveContents(
    channelId,
    store.filter((item) => item.channelId === channelId),
  );
  return { ...next };
}

/* =============================================================================
   Gate de aprovação humana (AGENTS.md, invariante nº 1)
   -----------------------------------------------------------------------------

   A aprovação não é um carimbo: é o par **conteúdo + versão**. Sem prender a versão, "aprovado"
   vira decorativo — dá para aprovar um vídeo, trocar título, descrição e thumbnail, e ele ir ao ar
   sem que ninguém tenha aprovado aquilo. Este bloco existe para que a pergunta "o que foi aprovado
   é o que vai ao ar?" tenha resposta verificável, e não presumida.
   ============================================================================= */

/**
 * Impressão da parte do conteúdo que **chega ao YouTube**. Só os campos de artefato entram aqui:
 * data de agendamento e status ficam de fora de propósito, porque reagendar não muda o vídeo.
 *
 * A ordem das chaves é fixa (literal de objeto) para a string ser estável entre chamadas — sem isso
 * a comparação acusaria diferença onde não há.
 */
export function contentSnapshot(
  item: Pick<ContentItem, 'format' | 'durationSec' | 'seo' | 'selectedThumbnailId'>,
): string {
  return JSON.stringify({
    format: item.format,
    durationSec: item.durationSec,
    title: item.seo.title,
    description: item.seo.description,
    tags: [...item.seo.tags],
    thumbnailId: item.selectedThumbnailId,
  });
}

/**
 * A aprovação vigente ainda descreve este conteúdo?
 *
 * Recusa por padrão (`false`) em tudo que não der para provar: sem registro, de outro canal, de
 * outro conteúdo, em estado que não é aprovado/agendado, ou com versão diferente da aprovada.
 */
export function isApprovalValid(item: ContentItem): boolean {
  const approval = item.approval;
  if (!approval) return false;
  if (approval.channelId !== item.channelId) return false;
  if (approval.contentId !== item.id) return false;
  if (item.status !== 'aprovado' && item.status !== 'agendado') return false;
  return approval.snapshot === contentSnapshot(item);
}

/**
 * Portão de publicação. **Todo caminho que publica tem de passar por aqui** antes de falar com o
 * YouTube — é a defesa em profundidade do invariante nº 1: mesmo que uma tela, um job ou um agente
 * tente publicar por fora, sem aprovação vigente a chamada é recusada.
 *
 * Assíncrono porque o caminho real (API + YouTube) é assíncrono; o formato já é o definitivo.
 */
export async function assertPublishable(channelId: ChannelId, contentId: string): Promise<ContentItem> {
  const item = findContent(channelId, contentId);
  if (!isApprovalValid(item)) {
    throw new Error(
      'Publicação recusada: não existe aprovação humana vigente para a versão atual deste conteúdo.',
    );
  }
  return { ...item };
}

/* =============================================================================
   Validação de entrada
   -----------------------------------------------------------------------------
   A interface também valida (`maxLength` no campo, botão desabilitado), mas validação de tela não
   é validação: qualquer caminho que não passe pelo React — link, teste, job, agente — chega cru na
   camada de dados. Os tetos abaixo valem para todos eles.
   ============================================================================= */

/** Mesmo teto do campo na tela de revisão (`RevisaoPage`). */
const TITLE_MIN = 3;
const TITLE_MAX = 100;
/** Mesmo teto do schema de IA para `rejeicoes` (`src/ai/schemas.ts`) — o motivo vai virar prompt. */
const REJECTION_MIN = 3;
const REJECTION_MAX = 400;

/**
 * Texto de uma linha só. Remove caracteres de controle (inclusive NUL) e colapsa espaços: um título
 * com quebra de linha ou NUL vira metadado estranho no YouTube e quebra log e CSV depois.
 */
function normalizeSingleLine(raw: string): string {
  const semControle = raw.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '');
  return semControle.replace(/\s+/g, ' ').trim();
}

/**
 * Texto longo vindo de fora: tira caractere de controle, normaliza espaços e corta no teto.
 *
 * Diferente de `normalizeSingleLine`, **preserva parágrafos** — a narração de um bloco é texto corrido, e
 * colapsar tudo numa linha atrapalharia a leitura na tela. O que não passa é caractere de controle: ele
 * viraria ruído no mesmo campo que depois alimenta prompt de imagem.
 */
function normalizeMultiline(raw: string, max: number): string {
  const semControle = raw.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '');
  return semControle
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, max);
}

/** Inteiro seguro dentro de uma faixa. Valor não finito vindo de fora cai no mínimo, nunca em `NaN`. */
function safeInt(raw: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(raw)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(raw)));
}

function requireTitle(raw: unknown): string {
  if (typeof raw !== 'string') throw new Error('Título inválido.');
  const title = normalizeSingleLine(raw);
  if (title.length < TITLE_MIN) throw new Error('O título precisa ter pelo menos 3 caracteres.');
  if (title.length > TITLE_MAX) throw new Error('O título precisa ter no máximo 100 caracteres.');
  return title;
}

function requireRejectionReason(raw: unknown): string {
  if (typeof raw !== 'string') throw new Error('Motivo inválido.');
  const reason = normalizeSingleLine(raw);
  if (reason.length < REJECTION_MIN) throw new Error('Conte o motivo da rejeição para a IA aprender.');
  if (reason.length > REJECTION_MAX) {
    throw new Error('O motivo da rejeição precisa ter no máximo 400 caracteres.');
  }
  return reason;
}

/** Aceita só data que o runtime consegue ler; devolve ISO normalizado. Recusa o resto em vez de gravar. */
function requireIsoInstant(raw: unknown): string {
  if (typeof raw !== 'string' || raw.trim() === '') throw new Error('Data e hora inválidas.');
  const ms = Date.parse(raw);
  if (!Number.isFinite(ms)) throw new Error('Data e hora inválidas.');
  return new Date(ms).toISOString();
}

/* =============================================================================
   Máquina de estados do ciclo
   -----------------------------------------------------------------------------
   Cada ação declara de onde pode partir. Sem isto, "aprovar" um conteúdo já publicado ou
   "reagendar" o que está no ar passa batido — e o estado local deixa de descrever a realidade.
   ============================================================================= */

function requireEditable(current: ContentItem): void {
  if (current.status === 'publicado') {
    throw new Error('Conteúdo já publicado: a edição aqui não mudaria o vídeo no ar.');
  }
}

function requireApprovable(current: ContentItem): void {
  if (current.status === 'publicado') {
    throw new Error('Conteúdo já publicado não pode ser aprovado de novo.');
  }
  if (current.status === 'gerando' || current.status === 'falhou') {
    throw new Error('Só conteúdo pronto para revisão pode ser aprovado.');
  }
}

/**
 * Edição do artefato (título, thumbnail, …): **derruba a aprovação** quando ela existia.
 *
 * É a correção central deste bloco. O conteúdo volta para a etapa "revisar" porque o que iria ao ar
 * deixou de ser o que o humano aprovou; a decisão tem de ser tomada de novo, por uma pessoa.
 */
function patchArtifact(channelId: ChannelId, contentId: string, patch: Partial<ContentItem>): ContentItem {
  const current = findContent(channelId, contentId);
  requireEditable(current);

  const precisaNovaAprovacao =
    current.approval !== null || current.status === 'aprovado' || current.status === 'agendado';

  return patchContent(channelId, contentId, {
    ...patch,
    approval: null,
    ...(precisaNovaAprovacao ? { status: 'revisao' as ContentStatus, stage: 'revisar' as const } : {}),
  });
}

/* =============================================================================
   Ciclo do personagem — opções → escolha → refino → aprovação
   -----------------------------------------------------------------------------
   O que o PDF do cliente pede, com estas palavras: *"O sistema gera opções. Eu escolho uma. Depois
   digo: 'Gostei desse, mas quero as orelhas maiores e sem coleira.' Ela gera novamente. Quando eu
   aprovar o personagem, ele vira um personagem oficial."*

   Quem gera é a função de IA (`identidade-personagem`), que **não grava nada** — ela devolve opções
   para a tela. Quem grava é este bloco, e só a partir de clique humano:

     `AiAction` (proposta)  →  `saveCharacterDraft` (escolha vira rascunho)  →  `approveCharacter`
     (rascunho vira oficial)

   Duas regras que não se negociam aqui:

   1. **Personagem novo nasce `rascunho`.** `approveCharacter` é o único caminho para `oficial` — não
      existe atalho, nem parâmetro de status vindo de fora.
   2. **Refinar não edita a ficha existente: cria uma nova.** A versão anterior permanece no registro,
      porque episódios já gerados usaram **ela** (`rebeca-branding`, princípio 5). Quando a nova é
      aprovada, a anterior deixa de ser oficial — `substituido` — em vez de continuarem duas
      identidades canônicas com o mesmo nome.
   ============================================================================= */

/** Tetos idênticos aos do schema de `identidade-personagem` (`src/ai/schemas.ts`) — a fonte é lá. */
const CHARACTER_NAME_MAX = 60;
const CHARACTER_ROLE_MIN = 3;
const CHARACTER_ROLE_MAX = 120;
const CHARACTER_VISUAL_MIN = 20;
const CHARACTER_VISUAL_MAX = 900;
const CHARACTER_TRAIT_MAX = 80;
const CHARACTER_TRAITS_MAX = 12;
const CHARACTER_PROMPT_MIN = 20;
const CHARACTER_PROMPT_MAX = 1200;
const CHARACTER_NEGATIVE_MAX = 600;
const CHARACTER_NOTES_MIN = 10;
const CHARACTER_NOTES_MAX = 800;

function findCharacter(channelId: ChannelId, characterId: string): Character {
  const found = characterStore.find(
    (item) => item.channelId === channelId && item.id === characterId,
  );
  if (!found) {
    // Mesma mensagem para "não existe" e para "não é deste canal": a interface não pode denunciar a
    // existência de um personagem de outro canal (invariante nº 2).
    throw new Error('Personagem não encontrado neste canal.');
  }
  return found;
}

/** Cópia de leitura: quem recebe um personagem não mexe na ficha guardada. */
function cloneCharacter(character: Character): Character {
  return {
    ...character,
    sheet: { ...character.sheet, tracos: [...character.sheet.tracos] },
    sheetOrigin: { ...character.sheetOrigin },
  };
}

function requireCharacterName(raw: unknown): string {
  if (typeof raw !== 'string') throw new Error('Nome de personagem inválido.');
  const nome = normalizeSingleLine(raw);
  if (nome.length === 0) throw new Error('O personagem precisa de um nome.');
  if (nome.length > CHARACTER_NAME_MAX) {
    throw new Error(`O nome do personagem precisa ter no máximo ${CHARACTER_NAME_MAX} caracteres.`);
  }
  return nome;
}

function requireCharacterRole(raw: unknown): string {
  const papel = normalizeSingleLine(typeof raw === 'string' ? raw : '');
  if (papel.length < CHARACTER_ROLE_MIN) {
    throw new Error(`O papel do personagem precisa ter pelo menos ${CHARACTER_ROLE_MIN} caracteres.`);
  }
  if (papel.length > CHARACTER_ROLE_MAX) {
    throw new Error(`O papel do personagem precisa ter no máximo ${CHARACTER_ROLE_MAX} caracteres.`);
  }
  return papel;
}

function requireVisualDescription(raw: unknown): string {
  const descricao = normalizeMultiline(typeof raw === 'string' ? raw : '', CHARACTER_VISUAL_MAX);
  if (descricao.length < CHARACTER_VISUAL_MIN) {
    throw new Error(
      `A descrição visual precisa ter pelo menos ${CHARACTER_VISUAL_MIN} caracteres: é ela que mantém o personagem igual entre episódios.`,
    );
  }
  return descricao;
}

/**
 * Traços canônicos. A lista **não pode ser vazia**: traço é o que se confere numa imagem para dizer
 * "é o mesmo personagem" — ficha sem traço checável não garante consistência nenhuma, então ela não
 * entra no canal (e, no `approveCharacter`, não vira oficial).
 */
function requireTraits(raw: unknown): string[] {
  if (!Array.isArray(raw)) throw new Error('Traços inválidos.');
  const tracos = raw
    .filter((item): item is string => typeof item === 'string')
    .map((item) => normalizeSingleLine(item).slice(0, CHARACTER_TRAIT_MAX))
    .filter((item) => item.length > 0)
    .slice(0, CHARACTER_TRAITS_MAX);
  if (tracos.length === 0) {
    throw new Error('A ficha precisa de pelo menos um traço checável em imagem.');
  }
  return tracos;
}

function requireImagePrompt(raw: unknown): string {
  const prompt = normalizeMultiline(typeof raw === 'string' ? raw : '', CHARACTER_PROMPT_MAX);
  if (prompt.length < CHARACTER_PROMPT_MIN) {
    throw new Error(`O prompt de imagem precisa ter pelo menos ${CHARACTER_PROMPT_MIN} caracteres.`);
  }
  return prompt;
}

function requireNegativePrompt(raw: unknown): string {
  return normalizeMultiline(typeof raw === 'string' ? raw : '', CHARACTER_NEGATIVE_MAX);
}

function requireSeed(raw: unknown): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    throw new Error('Seed inválida: sem ela não dá para reproduzir o mesmo personagem em outra geração.');
  }
  return safeInt(raw, 0, 2_147_483_647, 0);
}

function requireConsistencyNotes(raw: unknown): string {
  const notas = normalizeMultiline(typeof raw === 'string' ? raw : '', CHARACTER_NOTES_MAX);
  if (notas.length < CHARACTER_NOTES_MIN) {
    throw new Error(
      'As notas de consistência precisam dizer o que não pode mudar entre episódios.',
    );
  }
  return notas;
}

/**
 * Procedência da ficha — obrigatória e explícita.
 *
 * Ficha sem procedência é ficha que a lista não consegue explicar: **proposta simulada apresentada
 * como geração real é mentira de produto** (o mesmo motivo pelo qual `Roteiro` carrega `simulated` e
 * `promptId`). Por isso o campo não tem valor padrão: quem grava tem de dizer de onde veio.
 */
function requireSheetOrigin(raw: CharacterSheetOrigin): CharacterSheetOrigin {
  const source = (raw ?? {}) as unknown as Record<string, unknown>;
  const promptId =
    typeof source['promptId'] === 'string' ? normalizeSingleLine(source['promptId']).slice(0, 80) : '';
  const version = source['promptVersion'];
  if (promptId.length === 0 || typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    throw new Error(
      'Procedência da ficha ausente: registrar de qual prompt a proposta veio é o que permite auditar a ficha depois.',
    );
  }
  if (typeof source['simulated'] !== 'boolean') {
    throw new Error('Procedência da ficha incompleta: falta dizer se a proposta foi simulação ou geração real.');
  }
  return { promptId, promptVersion: version, simulated: source['simulated'] };
}

/** Ficha normalizada, pronta para ser gravada. */
interface NormalizedProposal {
  readonly name: string;
  readonly role: string;
  readonly sheet: CharacterSheet;
}

function requireProposal(proposal: CharacterProposal): NormalizedProposal {
  const raw = (proposal ?? {}) as unknown as Record<string, unknown>;
  return {
    name: requireCharacterName(raw['nome']),
    role: requireCharacterRole(raw['papel']),
    sheet: {
      descricaoVisual: requireVisualDescription(raw['descricaoVisual']),
      tracos: requireTraits(raw['tracos']),
      promptImagem: requireImagePrompt(raw['promptImagem']),
      negativePrompt: requireNegativePrompt(raw['negativePrompt']),
      seed: requireSeed(raw['seed']),
      notasConsistencia: requireConsistencyNotes(raw['notasConsistencia']),
    },
  };
}

/** Número de uma revisão `vN`. `null` quando a string não é uma revisão legível. */
function numeroDaVersao(versao: string): number | null {
  const match = /^v(\d+)$/.exec(versao.trim());
  const numero = match ? Number.parseInt(match[1] ?? '', 10) : Number.NaN;
  return Number.isInteger(numero) && numero >= 1 ? numero : null;
}

/**
 * Revisão seguinte de uma ficha: `v4` → `v5`.
 *
 * Se a versão de partida não for legível, a gravação é **recusada** em vez de recomeçar do `v1` por
 * conta própria: renumerar em silêncio apagaria a diferença entre duas fichas.
 */
export function nextSheetVersion(previous: string): string {
  const numero = numeroDaVersao(previous);
  if (numero === null) {
    throw new Error(`Não dá para derivar uma revisão nova a partir de "${previous}".`);
  }
  return `v${numero + 1}`;
}

/**
 * A revisão que a próxima ficha desta **identidade** vai receber — sempre **topo + 1**.
 *
 * Subir a partir da base não bastava, e o `rebeca-qa` mediu por quê (`docs/qa/QA-015-fases-1-e-2.md`,
 * achado 2): refinando uma versão `substituido` (ou abrindo duas ramificações da mesma base), a ficha
 * nova reemitia o número de uma ficha **viva** — duas `v2` convivendo, e "qual ficha o episódio usou?"
 * sem resposta. A subida de versão só torna o refino auditável se o número nunca se repetir dentro da
 * identidade, então o cálculo olha para todas as fichas dela, não só para a base.
 *
 * "Identidade" aqui é o nome normalizado (`mesmaIdentidade`) **mais** a linhagem da base — o refino
 * pode renomear o personagem, e nesse caso a continuidade da versão tem de vir da linhagem.
 */
function proximaVersaoDaIdentidade(
  channelId: ChannelId,
  name: string,
  base: Character | undefined,
): string {
  const raiz = base ? lineageRootId(base.id) : null;
  const daIdentidade = characterStore.filter(
    (item) =>
      item.channelId === channelId &&
      (mesmaIdentidade(item.name, name) || (raiz !== null && lineageRootId(item.id) === raiz)),
  );

  let maior = 0;
  for (const item of daIdentidade) {
    const numero = numeroDaVersao(item.sheetVersion);
    // Sem saber quais números já foram usados, reemitir seria pior do que parar.
    if (numero === null) {
      throw new Error(`Não dá para ler a revisão da ficha de "${item.name}": "${item.sheetVersion}".`);
    }
    maior = Math.max(maior, numero);
  }

  // A primeira ficha de uma identidade nasce `v1`; qualquer ficha seguinte sobe do topo dela.
  return maior === 0 ? 'v1' : nextSheetVersion(`v${maior}`);
}

/** Cor do ícone do cartão — apresentação, não dado de marca. Rodízio para não repetir no canal. */
const CHARACTER_TONES: readonly TileTone[] = [
  'cyan',
  'blue',
  'violet',
  'green',
  'amber',
  'rose',
  'pink',
  'teal',
];

function nextCharacterTone(channelId: ChannelId): TileTone {
  const existentes = characterStore.filter((item) => item.channelId === channelId).length;
  return CHARACTER_TONES[existentes % CHARACTER_TONES.length] ?? 'blue';
}

/**
 * Identidade do personagem dentro do canal — o nome reduzido à forma que um humano lê como o mesmo.
 *
 * Tira acento, caixa e separador: `Bentó`, `bento`, `Ben  to` e `Ben-to` são **a mesma** identidade.
 * Esta é a **única** regra de comparação de nome neste arquivo: o `id` e a substituição da versão
 * oficial passam por aqui, e não podem divergir.
 *
 * Já divergiram uma vez, e o `rebeca-qa` mediu o resultado (`docs/qa/QA-015-fases-1-e-2.md`, achado 3):
 * o gerador de `id` tirava o diacrítico e a comparação de identidade não, então aprovar `Bento` e
 * depois `Bentó` deixava **dois** personagens `oficial` para o mesmo cachorro — o invariante nº 3
 * ("a Luna parece a Luna") furado por um acento.
 */
function identidadeDoNome(raw: string): string {
  return normalizeSingleLine(raw)
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '');
}

function mesmaIdentidade(a: string, b: string): boolean {
  return identidadeDoNome(a) === identidadeDoNome(b);
}

function nextCharacterId(channelId: ChannelId, name: string): string {
  const slug = identidadeDoNome(name).slice(0, 40) || 'personagem';
  const base = `${channelId}-${slug}`;
  let id = base;
  let sufixo = 2;
  while (characterStore.some((item) => item.id === id)) id = `${base}-${sufixo++}`;
  return id;
}

/** Raiz da linhagem: sobe por `derivedFromId` até o personagem criado do zero. */
function lineageRootId(characterId: string): string {
  let atual = characterId;
  const visitados = new Set<string>();
  for (;;) {
    if (visitados.has(atual)) return atual;
    visitados.add(atual);
    const item = characterStore.find((character) => character.id === atual);
    if (!item || item.derivedFromId === null) return atual;
    atual = item.derivedFromId;
  }
}

/** O que o humano aceitou ao escolher uma opção, e de onde ela veio. */
export interface CharacterDraftInput {
  /** A ficha escolhida. É exatamente o que a IA propôs — nada é reinterpretado no caminho. */
  readonly proposal: CharacterProposal;
  /** De qual personagem este rascunho foi refinado. Ausente/`null` = criado do zero. */
  readonly derivedFromId?: string | null;
  /** Procedência da proposta (prompt, versão e se foi simulação). Obrigatória. */
  readonly origin: CharacterSheetOrigin;
}

export interface CharacterApprovalResult {
  readonly character: Character;
  /**
   * Versões oficiais que **deixaram** de ser oficiais nesta aprovação.
   *
   * Vem na resposta, e não é dedução da tela: a mensagem "a v4 foi substituída" só pode aparecer
   * quando existe uma v4 substituída de verdade.
   */
  readonly superseded: Character[];
}

/* =============================================================================
   Consultas
   ============================================================================= */

export interface ContentFilter {
  status?: ContentStatus;
  format?: 'video' | 'short';
  theme?: string;
}

export const api = {
  async listChannels(): Promise<Channel[]> {
    await delay(120);
    return channels.map((channel) => ({ ...channel }));
  },

  async getChannel(channelId: ChannelId): Promise<Channel> {
    await delay(80);
    const channel = channelById(channelId);
    if (!channel) throw new Error('Canal não encontrado.');
    return { ...channel };
  },

  async getKpis(channelId: ChannelId): Promise<ChannelKpis> {
    await delay(140);
    const row = kpisFor(channelId);
    if (!row) throw new Error('Não foi possível carregar os indicadores deste canal.');
    return { ...row };
  },

  async listContents(channelId: ChannelId, filter: ContentFilter = {}): Promise<ContentItem[]> {
    await delay(180);
    return store
      .filter((item) => item.channelId === channelId)
      .filter((item) => (filter.status ? item.status === filter.status : true))
      .filter((item) => (filter.format ? item.format === filter.format : true))
      .filter((item) => (filter.theme ? item.theme === filter.theme : true))
      .map((item) => ({ ...item }));
  },

  /** A fila de revisão é o coração do produto: só o que espera decisão humana. */
  async getReviewQueue(channelId: ChannelId): Promise<ContentItem[]> {
    await delay(200);
    return store
      .filter((item) => item.channelId === channelId && item.status === 'revisao')
      .map((item) => ({ ...item }));
  },

  async getContent(channelId: ChannelId, contentId: string): Promise<ContentItem> {
    await delay(160);
    return { ...findContent(channelId, contentId) };
  },

  async getWeek(channelId: ChannelId): Promise<WeeklySlot[]> {
    await delay(150);
    const mine = store.filter((item) => item.channelId === channelId);
    return currentWeekDays.map((date) => {
      const iso = toIsoDate(date);
      return {
        weekday: date.getDay(),
        date: iso,
        content:
          mine.find((item) => item.scheduledAt && toIsoDate(new Date(item.scheduledAt)) === iso) ?? null,
      };
    });
  },

  async getModules(channelId: ChannelId): Promise<ModuleState[]> {
    await delay(120);
    return modulesFor(channelId).map((mod) => ({ ...mod }));
  },

  async getCharacters(channelId: ChannelId): Promise<Character[]> {
    await delay(130);
    return characterStore
      .filter((character) => character.channelId === channelId)
      .map(cloneCharacter);
  },

  async getBrandKit(channelId: ChannelId): Promise<BrandKit> {
    await delay(110);
    const kit = brandKitFor(channelId);
    if (!kit) throw new Error('Este canal ainda não tem Brand Kit.');
    return { ...kit, palette: kit.palette.map((c) => ({ ...c })), fonts: kit.fonts.map((f) => ({ ...f })) };
  },

  async getRecommendations(channelId: ChannelId): Promise<Recommendation[]> {
    await delay(140);
    return recommendationsFor(channelId).map((item) => ({ ...item }));
  },

  /** Única leitura que cruza canais — e é somente leitura/agregada. */
  async getPortfolio(): Promise<PortfolioRow[]> {
    await delay(200);
    return channels.flatMap((channel) => {
      const row = kpis.find((k) => k.channelId === channel.id);
      // Sem indicador não há linha: melhor faltar a linha do que mostrar zero inventado.
      return row ? [{ channel: { ...channel }, kpis: { ...row } }] : [];
    });
  },

  /* ----------------------------------------------------------------- ações */

  async selectThumbnail(
    channelId: ChannelId,
    contentId: string,
    thumbnailId: string,
  ): Promise<ContentItem> {
    await delay(220);
    const has = findContent(channelId, contentId).thumbnails.some((t) => t.id === thumbnailId);
    if (!has) throw new Error('Essa opção de thumbnail não pertence a este conteúdo.');
    // `patchArtifact`, não `patchContent`: trocar a thumbnail depois de aprovado invalida a aprovação.
    return patchArtifact(channelId, contentId, { selectedThumbnailId: thumbnailId });
  },

  /**
   * Aplica as opções de thumbnail **propostas pela IA** (`criar-thumbnail`).
   *
   * Esta é a porta que faltava: a função de IA existia no servidor desde a camada de LLM, mas nenhuma
   * tela a chamava — o dono do produto olhou a etapa "Escolha a thumbnail" e a conclusão foi "não dá
   * opção de gerar". Aqui entram os conceitos propostos (rótulo + o que a arte deve mostrar), **não a
   * arte**: gerar imagem é do pipeline de mídia (`ADR-010`), que ainda não existe.
   *
   * Passa por `patchArtifact` pelo mesmo motivo de `selectThumbnail` e `saveTitle`: trocar a thumbnail
   * de um conteúdo já aprovado **derruba a aprovação** e devolve o conteúdo para revisão — o que iria
   * ao ar deixou de ser o que o humano aprovou. E a escolha anterior é **limpa**: manter um
   * `selectedThumbnailId` apontando para uma opção que não existe mais seria estado mentiroso.
   */
  async proposeThumbnails(
    channelId: ChannelId,
    contentId: string,
    options: readonly ThumbnailOption[],
  ): Promise<ContentItem> {
    await delay(180);
    if (options.length === 0) throw new Error('A IA não devolveu nenhuma opção para aplicar.');

    // Teto de 4 (o mesmo do schema da função) e corte de tamanho: a tela e o registro não guardam
    // texto sem limite vindo de fora.
    const sane = options.slice(0, 4).map((option) => ({
      id: option.id.trim().slice(0, 40),
      label: option.label.trim().slice(0, 60),
      alt: option.alt.trim().slice(0, 300),
      suggested: option.suggested,
    }));

    return patchArtifact(channelId, contentId, {
      thumbnails: sane,
      selectedThumbnailId: null,
    });
  },

  /**
   * Grava o roteiro que a IA escreveu (`criar-roteiro`) — depois do clique humano em "Usar este roteiro".
   *
   * A IA **não** grava sozinha: o `AiAction` só mostra a proposta, e quem persiste é esta porta
   * (invariante nº 1). Passa por `patchArtifact`, então gerar roteiro num conteúdo já aprovado **derruba a
   * aprovação** — o que iria ao ar deixou de ser o que o humano aprovou.
   *
   * O storyboard vai junto para o lixo, e isso é decisão, não descuido: ele foi derivado de um roteiro
   * que deixou de existir. Manter cenas apontando para narração antiga seria estado mentiroso — o mesmo
   * motivo pelo qual `proposeThumbnails` limpa a escolha anterior.
   */
  async saveRoteiro(channelId: ChannelId, contentId: string, roteiro: Roteiro): Promise<ContentItem> {
    await delay(180);
    const blocos = roteiro.blocos.slice(0, 40).map((bloco, index) => ({
      ordem: safeInt(bloco.ordem, 1, 60, index + 1),
      tempoInicioSeg: safeInt(bloco.tempoInicioSeg, 0, 1800, 0),
      tempoFimSeg: safeInt(bloco.tempoFimSeg, 1, 1800, 1),
      narracao: normalizeMultiline(bloco.narracao, 1200),
      acao: normalizeMultiline(bloco.acao, 600),
      emocao: normalizeSingleLine(bloco.emocao).slice(0, 60),
    }));
    if (blocos.length === 0) throw new Error('A IA não devolveu nenhum bloco de roteiro para aplicar.');

    return patchArtifact(channelId, contentId, {
      roteiro: {
        titulo: normalizeSingleLine(roteiro.titulo).slice(0, 100),
        logline: normalizeMultiline(roteiro.logline, 400),
        moral: normalizeSingleLine(roteiro.moral).slice(0, 200),
        blocos,
        geradoEm: roteiro.geradoEm,
        promptId: normalizeSingleLine(roteiro.promptId).slice(0, 80),
        simulated: roteiro.simulated,
      },
      storyboard: undefined,
    });
  },

  /**
   * Grava o storyboard (`criar-cena`), derivado do roteiro que já está no conteúdo.
   *
   * Cena é a **entrada do pipeline de mídia**: `promptImagem` e `seed` são o que a etapa de imagem precisa
   * para ser determinística. Sem isto gravado, a Fase 1 não tem de onde partir — era a peça que faltava
   * para "gerar o vídeo" significar alguma coisa.
   *
   * Recusa storyboard sem roteiro: cenas sem narração de origem afirmariam uma linhagem que ninguém
   * declarou, que é a mesma regra que impede a tela de ligar conteúdo e episódio por semelhança de nome.
   */
  async saveStoryboard(channelId: ChannelId, contentId: string, storyboard: Storyboard): Promise<ContentItem> {
    await delay(180);
    const atual = findContent(channelId, contentId);
    if (atual.roteiro === undefined) {
      throw new Error('Gere o roteiro antes do storyboard: as cenas precisam da narração de origem.');
    }

    const cenas: Cena[] = storyboard.cenas.slice(0, 60).map((cena, index) => ({
      numero: safeInt(cena.numero, 1, 60, index + 1),
      duracaoSeg: safeInt(cena.duracaoSeg, 1, 120, 1),
      descricao: normalizeMultiline(cena.descricao, 500),
      enquadramento: normalizeSingleLine(cena.enquadramento).slice(0, 80),
      paleta: cena.paleta.slice(0, 6).map((cor) => normalizeSingleLine(cor).slice(0, 40)),
      promptImagem: normalizeMultiline(cena.promptImagem, 1200),
      negativePrompt: normalizeMultiline(cena.negativePrompt, 600),
      seed: safeInt(cena.seed, 0, 2_147_483_647, index + 1),
    }));
    if (cenas.length === 0) throw new Error('A IA não devolveu nenhuma cena para aplicar.');

    return patchArtifact(channelId, contentId, {
      storyboard: {
        cenas,
        geradoEm: storyboard.geradoEm,
        promptId: normalizeSingleLine(storyboard.promptId).slice(0, 80),
        simulated: storyboard.simulated,
      },
    });
  },

  async saveTitle(channelId: ChannelId, contentId: string, title: string): Promise<ContentItem> {
    await delay(200);
    const limpo = requireTitle(title);
    const current = findContent(channelId, contentId);
    return patchArtifact(channelId, contentId, { seo: { ...current.seo, title: limpo } });
  },

  /**
   * Aprovação humana. É a única porta para "agendado" — a IA nunca chama isso sozinha
   * (AGENTS.md, invariante nº 1).
   *
   * O que ela grava é um `ApprovalRecord`: **quem** aprovou ainda não existe no produto (D3 aberto,
   * sem autenticação), mas **o quê**, **quando** e **em que canal** ficam registrados — e é isso que
   * permite ao portão de publicação (`assertPublishable`) provar que a versão no ar é a aprovada.
   */
  async approve(
    channelId: ChannelId,
    contentId: string,
    scheduledAt: string | null,
  ): Promise<ContentItem> {
    await delay(320);
    const quando = scheduledAt === null ? null : requireIsoInstant(scheduledAt);
    const current = findContent(channelId, contentId);
    requireApprovable(current);
    if (!current.selectedThumbnailId) {
      throw new Error('Escolha uma thumbnail antes de aprovar.');
    }

    const approval: ApprovalRecord = {
      approvedAt: new Date().toISOString(),
      channelId,
      contentId,
      snapshot: contentSnapshot(current),
      scheduledAt: quando,
    };

    return patchContent(channelId, contentId, {
      status: quando ? 'agendado' : 'aprovado',
      // Aprovado com data entra na etapa "agendar" — publicar vem depois, quando a data chega.
      stage: quando ? 'agendar' : 'aprovar',
      scheduledAt: quando ?? current.scheduledAt,
      approval,
    });
  },

  /** "Gostei da ideia, não da execução." */
  async requestNewVersion(channelId: ChannelId, contentId: string): Promise<ContentItem> {
    await delay(280);
    requireEditable(findContent(channelId, contentId));
    return patchContent(channelId, contentId, {
      status: 'gerando',
      stage: 'criar',
      metrics: null,
      // Gerar outra versão é, por definição, deixar de valer a aprovação da anterior.
      approval: null,
    });
  },

  /** "Não gostei de nada." O motivo vira aprendizado — por isso é obrigatório. */
  async reject(channelId: ChannelId, contentId: string, reason: string): Promise<ContentItem> {
    await delay(280);
    const motivo = requireRejectionReason(reason);
    requireEditable(findContent(channelId, contentId));
    return patchContent(channelId, contentId, {
      status: 'gerando',
      stage: 'criar',
      metrics: null,
      rejectedReason: motivo,
      approval: null,
    });
  },

  /**
   * Reagendar mantém o conteúdo na etapa "agendar": ele ainda não foi publicado.
   *
   * Não invalida a aprovação — o vídeo aprovado não mudou, só a data. O registro da aprovação é
   * atualizado para a nova data, porque reagendar também é ato humano sobre o mesmo artefato.
   */
  async reschedule(channelId: ChannelId, contentId: string, scheduledAt: string): Promise<ContentItem> {
    await delay(240);
    const quando = requireIsoInstant(scheduledAt);
    const current = findContent(channelId, contentId);
    requireEditable(current);

    return patchContent(channelId, contentId, {
      scheduledAt: quando,
      status: 'agendado',
      stage: 'agendar',
      approval: current.approval ? { ...current.approval, scheduledAt: quando } : null,
    });
  },

  /* ------------------------------------------------------------- personagens */

  /**
   * Grava a **escolha** do humano: a opção que ele apontou vira um personagem `rascunho` do canal.
   *
   * Este é o segundo tempo do ciclo do PDF ("o sistema gera opções. **Eu escolho uma**"). A IA fica de
   * fora: ela propôs; quem chama isto é o clique em "Escolher esta opção" na tela de Identidade.
   *
   * Três decisões que estão embutidas aqui:
   *
   * 1. **Nasce `rascunho`.** Não existe parâmetro de status: `approveCharacter` é o único caminho para
   *    `oficial`, e nenhuma proposta de IA chega lá sozinha.
   * 2. **Refino cria versão nova, não edita a antiga.** `derivedFromId` aponta para a ficha de origem e
   *    o `sheetVersion` sobe (`v2` → `v3`). A anterior continua no canal, porque episódios já gerados
   *    usaram **ela** — trocar a ficha oficial sob os pés desses episódios é o defeito que o
   *    invariante nº 3 proíbe.
   * 3. **`derivedFromId` é validado contra o canal.** Apontar para personagem de outro canal é recusado
   *    com a mesma mensagem de "não existe": não vaza a existência do dado alheio.
   */
  async saveCharacterDraft(
    channelId: ChannelId,
    input: CharacterDraftInput,
  ): Promise<Character> {
    await delay(220);
    const { name, role, sheet } = requireProposal(input.proposal);
    const origin = requireSheetOrigin(input.origin);

    const derivedFromId = input.derivedFromId ?? null;
    const base = derivedFromId === null ? undefined : findCharacter(channelId, derivedFromId);

    const criado: Character = {
      id: nextCharacterId(channelId, name),
      channelId,
      name,
      role,
      sheetVersion: proximaVersaoDaIdentidade(channelId, name, base),
      status: 'rascunho',
      tone: base ? base.tone : nextCharacterTone(channelId),
      sheet,
      derivedFromId: base ? base.id : null,
      sheetOrigin: origin,
    };

    characterStore = [...characterStore, criado];
    saveCharacters(
      channelId,
      characterStore.filter((item) => item.channelId === channelId),
    );
    return cloneCharacter(criado);
  },

  /**
   * Aprovação humana do personagem. **Único caminho** para `oficial` (o PDF: *"quando eu aprovar o
   * personagem, ele vira um personagem oficial"*).
   *
   * O que ela faz, e por quê:
   *
   * - **Recusa ficha incompleta.** Oficial sem traço checável ou sem prompt de imagem seria um
   *   "canônico" que não descreve nada — e é ele que a geração de imagem vai repetir em todo episódio.
   * - **Substitui a versão oficial anterior.** Duas identidades oficiais com o mesmo nome tornariam
   *   "a identidade canônica" uma pergunta sem resposta. A anterior não é apagada: fica `substituido`,
   *   que é a verdade — ela foi oficial e os episódios já gerados usaram a ficha dela.
   * - **Registra o fato da aprovação** (`approvedAt`, canal e versão da ficha). `approvedBy` continua
   *   pendente do modelo de acesso (D3, sem autenticação): inventar um nome de usuário seria inventar
   *   dado, e a tela diz isso em vez de fingir.
   */
  async approveCharacter(
    channelId: ChannelId,
    characterId: string,
  ): Promise<CharacterApprovalResult> {
    await delay(260);
    const atual = findCharacter(channelId, characterId);

    if (atual.status === 'oficial') throw new Error('Este personagem já é oficial.');
    if (atual.status === 'substituido') {
      throw new Error(
        'Esta versão foi substituída por uma mais nova: aprove a versão vigente ou refine de novo.',
      );
    }

    // Portão da ficha: o que o humano está tornando canônico tem de estar descrito por inteiro.
    requireProposal({ nome: atual.name, papel: atual.role, ...atual.sheet });

    const raiz = lineageRootId(atual.id);
    const alvos = characterStore.filter(
      (item) =>
        item.channelId === channelId &&
        item.id !== atual.id &&
        item.status === 'oficial' &&
        (lineageRootId(item.id) === raiz || mesmaIdentidade(item.name, atual.name)),
    );

    const substituidos: Character[] = [];
    if (alvos.length > 0) {
      const ids = new Set(alvos.map((item) => item.id));
      characterStore = characterStore.map((item) =>
        ids.has(item.id) ? { ...item, status: 'substituido' as const } : item,
      );
      for (const item of characterStore) {
        if (ids.has(item.id)) substituidos.push(cloneCharacter(item));
      }
    }

    const aprovado: Character = {
      ...atual,
      status: 'oficial',
      approvedAt: new Date().toISOString(),
    };
    characterStore = characterStore.map((item) =>
      item.id === aprovado.id && item.channelId === channelId ? aprovado : item,
    );
    saveCharacters(
      channelId,
      characterStore.filter((item) => item.channelId === channelId),
    );

    return { character: cloneCharacter(aprovado), superseded: substituidos };
  },
};

/* =============================================================================
   Contagem para a home e para a sidebar
   ============================================================================= */

export function countAwaitingReview(channelId: ChannelId): number {
  return store.filter((item) => item.channelId === channelId && item.status === 'revisao').length;
}

export const today = todayIso;
