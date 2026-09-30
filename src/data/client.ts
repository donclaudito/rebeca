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

/** Cópia mutável — aprovar/agendar precisa "pegar" durante a sessão de demonstração. */
let store: ContentItem[] = contents.map((item) => ({
  ...item,
  seo: { ...item.seo, tags: [...item.seo.tags] },
  thumbnails: item.thumbnails.map((thumb) => ({ ...thumb })),
}));

/** Restaura o estado de exemplo (usado por testes e pelo botão "reiniciar exemplo"). */
export function resetStore(): void {
  store = contents.map((item) => ({
    ...item,
    seo: { ...item.seo, tags: [...item.seo.tags] },
    thumbnails: item.thumbnails.map((thumb) => ({ ...thumb })),
  }));
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

function updateContent(channelId: ChannelId, contentId: string, patch: Partial<ContentItem>): ContentItem {
  const current = findContent(channelId, contentId);
  const next: ContentItem = { ...current, ...patch };
  store = store.map((item) => (item === current ? next : item));
  return next;
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
    return updateContent(channelId, contentId, { selectedThumbnailId: thumbnailId });
  },

  async saveTitle(channelId: ChannelId, contentId: string, title: string): Promise<ContentItem> {
    await delay(200);
    const trimmed = title.trim();
    if (trimmed.length < 3) throw new Error('O título precisa ter pelo menos 3 caracteres.');
    const current = findContent(channelId, contentId);
    return updateContent(channelId, contentId, { seo: { ...current.seo, title: trimmed } });
  },

  /**
   * Aprovação humana. É a única porta para "agendado" — a IA nunca chama isso sozinha
   * (AGENTS.md, invariante nº 1).
   */
  async approve(
    channelId: ChannelId,
    contentId: string,
    scheduledAt: string | null,
  ): Promise<ContentItem> {
    await delay(320);
    const current = findContent(channelId, contentId);
    if (!current.selectedThumbnailId) {
      throw new Error('Escolha uma thumbnail antes de aprovar.');
    }
    return updateContent(channelId, contentId, {
      status: scheduledAt ? 'agendado' : 'aprovado',
      // Aprovado com data entra na etapa "agendar" — publicar vem depois, quando a data chega.
      stage: scheduledAt ? 'agendar' : 'aprovar',
      scheduledAt: scheduledAt ?? current.scheduledAt,
    });
  },

  /** "Gostei da ideia, não da execução." */
  async requestNewVersion(channelId: ChannelId, contentId: string): Promise<ContentItem> {
    await delay(280);
    return updateContent(channelId, contentId, {
      status: 'gerando',
      stage: 'criar',
      metrics: null,
    });
  },

  /** "Não gostei de nada." O motivo vira aprendizado — por isso é obrigatório. */
  async reject(channelId: ChannelId, contentId: string, reason: string): Promise<ContentItem> {
    await delay(280);
    const trimmed = reason.trim();
    if (trimmed.length < 3) throw new Error('Conte o motivo da rejeição para a IA aprender.');
    return updateContent(channelId, contentId, {
      status: 'gerando',
      stage: 'criar',
      metrics: null,
      rejectedReason: trimmed,
    });
  },

  /** Reagendar mantém o conteúdo na etapa "agendar": ele ainda não foi publicado. */
  async reschedule(channelId: ChannelId, contentId: string, scheduledAt: string): Promise<ContentItem> {
    await delay(240);
    return updateContent(channelId, contentId, { scheduledAt, status: 'agendado', stage: 'agendar' });
  },
};

/* =============================================================================
   Contagem para a home e para a sidebar
   ============================================================================= */

export function countAwaitingReview(channelId: ChannelId): number {
  return store.filter((item) => item.channelId === channelId && item.status === 'revisao').length;
}

export const today = todayIso;
