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
  Channel,
  ChannelId,
  ChannelKpis,
  Character,
  ContentItem,
  ContentStatus,
  ModuleState,
  PortfolioRow,
  Recommendation,
  ThumbnailOption,
  WeeklySlot,
} from './types';
import { channels, contents, todayIso } from './mock/db';
import {
  brandKitFor,
  channelById,
  charactersFor,
  currentWeekDays,
  kpis,
  kpisFor,
  modulesFor,
  recommendationsFor,
} from './mock/db';
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

let store: ContentItem[] = seedStore();

/** Restaura o estado de exemplo (usado por testes e pelo botão "reiniciar exemplo"). */
export function resetStore(): void {
  store = seedStore();
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
    return charactersFor(channelId).map((character) => ({ ...character }));
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
};

/* =============================================================================
   Contagem para a home e para a sidebar
   ============================================================================= */

export function countAwaitingReview(channelId: ChannelId): number {
  return store.filter((item) => item.channelId === channelId && item.status === 'revisao').length;
}

export const today = todayIso;
