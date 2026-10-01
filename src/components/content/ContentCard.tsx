import { Link } from 'react-router-dom';
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
  /** O conteúdo que está aberto (`?aberto=`): marcado, para o olho achar o que está em foco. */
  destacado?: boolean;
}

/**
 * Cartão de conteúdo no desenho do cartão de vídeo do YouTube (docs/03 §5):
 * thumbnail 16:9 com a duração no canto, título de duas linhas e, embaixo, os
 * metadados.
 *
 * A thumbnail é um `ArtSlot` — a arte é do `rebeca-branding` (docs/03 §8) — e o alt
 * descreve a cena da opção escolhida, não o nome do arquivo.
 *
 * O estado continua como `StatusPill` **com rótulo escrito**: é a única informação
 * que o YouTube não tem e que este produto não pode perder.
 */
export function ContentCard({ item, channelId, destacado = false }: ContentCardProps) {
  const chosen = item.thumbnails.find((thumb) => thumb.id === item.selectedThumbnailId);
  const target =
    item.status === 'revisao'
      ? `/c/${channelId}/revisao/${item.id}`
      : `/c/${channelId}/conteudo?aberto=${item.id}`;

  return (
    <Card
      className={cn('p-3 flex flex-col gap-3', destacado && 'ring-2 ring-accent')}
      aria-current={destacado ? 'true' : undefined}
    >
      <Link to={target} className="ams-thumb block" aria-label={`Abrir ${item.title}`}>
        <ArtSlot
          label={chosen ? `Thumbnail: ${chosen.label}` : 'Thumbnail'}
          alt={chosen ? chosen.alt : `Espaço da thumbnail de ${item.title}`}
          className="!rounded-none !border-0"
        />
        <span className="ams-thumb__badge">{formatDuration(item.durationSec)}</span>
      </Link>

      <div className="flex flex-col gap-2 min-w-0">
        <Link
          to={target}
          className="text-[14px] font-medium text-ink leading-snug line-clamp-2 no-underline"
        >
          {item.title}
        </Link>

        <p className="text-[12px] text-ink-3 line-clamp-2 -mt-1">{item.hook}</p>

        <div className="flex items-center gap-2 flex-wrap">
          <StatusPill status={item.status} />
          <span className="text-[12px] text-ink-3">{formatLabel(item.format)}</span>
          <span className="text-[12px] text-ink-3" aria-hidden="true">
            ·
          </span>
          <span className="text-[12px] text-ink-2 truncate">{item.theme}</span>
        </div>

        <div className="flex items-center justify-between gap-2 pt-2 border-t border-divider">
          <span className="text-[12px] text-ink-3">
            {item.status === 'publicado' && item.metrics
              ? `${formatCompact(item.metrics.views)} views`
              : item.scheduledAt
                ? `Agendado ${formatDayMonthTime(new Date(item.scheduledAt))}`
                : 'Sem data definida'}
          </span>
          <span className={cn('text-[12px]', item.costUsd > 0 ? 'text-ink-2' : 'text-ink-3')}>
            {item.costUsd > 0 ? `custo ${formatUsd(item.costUsd)}` : 'custo não lançado'}
          </span>
        </div>
      </div>
    </Card>
  );
}
