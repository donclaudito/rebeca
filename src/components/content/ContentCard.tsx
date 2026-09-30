import { Link } from 'react-router-dom';
import { Clock } from 'lucide-react';
import { ArtSlot, Card, Pill, cn } from '@/components/ui/primitives';
import { STATUS_META, formatLabel } from '@/components/status';
import { formatCompact, formatDuration, formatUsd } from '@/lib/format';
import { formatDayMonthTime } from '@/lib/date';
import type { ChannelId, ContentItem } from '@/data/types';

export function StatusPill({ status }: { status: ContentItem['status'] }) {
  const meta = STATUS_META[status];
  return <Pill tone={meta.tone}>{meta.label}</Pill>;
}

interface ContentCardProps {
  item: ContentItem;
  channelId: ChannelId;
}

/**
 * Cartão de conteúdo. A thumbnail é um `ArtSlot` — a arte é do `rebeca-branding` (docs/03 §8) — e o
 * alt descreve a cena da opção escolhida, não o nome do arquivo.
 */
export function ContentCard({ item, channelId }: ContentCardProps) {
  const chosen = item.thumbnails.find((thumb) => thumb.id === item.selectedThumbnailId);
  const target =
    item.status === 'revisao'
      ? `/c/${channelId}/revisao/${item.id}`
      : `/c/${channelId}/conteudo?aberto=${item.id}`;

  return (
    <Card className="p-3 flex flex-col gap-3">
      <Link to={target} className="block" aria-label={`Abrir ${item.title}`}>
        <ArtSlot
          label={chosen ? `Thumbnail: ${chosen.label}` : 'Thumbnail'}
          alt={chosen ? chosen.alt : `Espaço da thumbnail de ${item.title}`}
        />
      </Link>

      <div className="flex flex-col gap-1.5 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <Link
            to={target}
            className="text-[13px] font-semibold text-ink leading-snug hover:underline"
          >
            {item.title}
          </Link>
          <StatusPill status={item.status} />
        </div>

        <p className="text-[11px] text-ink-3 line-clamp-2">{item.hook}</p>

        <div className="flex items-center gap-2 flex-wrap text-[11px] text-ink-3 pt-1">
          <span className="inline-flex items-center gap-1">
            <Clock size={12} aria-hidden="true" />
            {formatDuration(item.durationSec)}
          </span>
          <span aria-hidden="true">·</span>
          <span>{formatLabel(item.format)}</span>
          <span aria-hidden="true">·</span>
          <span className="text-ink-2">{item.theme}</span>
        </div>

        <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-line mt-1">
          <span className="text-[11px] text-ink-3">
            {item.status === 'publicado' && item.metrics
              ? `${formatCompact(item.metrics.views)} views`
              : item.scheduledAt
                ? `Agendado ${formatDayMonthTime(new Date(item.scheduledAt))}`
                : 'Sem data definida'}
          </span>
          <span className={cn('text-[11px]', item.costUsd > 0 ? 'text-ink-2' : 'text-ink-3')}>
            {item.costUsd > 0 ? `custo ${formatUsd(item.costUsd)}` : 'custo não lançado'}
          </span>
        </div>
      </div>
    </Card>
  );
}
