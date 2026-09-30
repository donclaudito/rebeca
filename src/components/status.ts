/**
 * Rótulo e tom de cada estado do conteúdo.
 * Cor nunca aparece sem rótulo (docs/03 §2.4): este arquivo é a única fonte do par.
 */

import type { ContentStatus, PillTone } from '@/data/types';

export const STATUS_META: Record<ContentStatus, { label: string; tone: PillTone }> = {
  gerando: { label: 'Em produção', tone: 'info' },
  revisao: { label: 'Aguardando aprovação', tone: 'warn' },
  aprovado: { label: 'Aprovado', tone: 'ok' },
  agendado: { label: 'Agendado', tone: 'info' },
  publicado: { label: 'Publicado', tone: 'ok' },
  falhou: { label: 'Falhou', tone: 'danger' },
};

export function statusLabel(status: ContentStatus): string {
  return STATUS_META[status].label;
}

export function formatLabel(format: 'video' | 'short'): string {
  return format === 'video' ? 'Vídeo longo' : 'Short';
}
