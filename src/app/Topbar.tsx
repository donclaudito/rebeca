import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bell, Sparkles } from 'lucide-react';
import { api, qk } from '@/data/client';
import { ChannelSwitcher } from './ChannelSwitcher';
import type { ChannelId } from '@/data/types';

interface TopbarProps {
  channelId?: ChannelId;
}

export function Topbar({ channelId }: TopbarProps) {
  const queueQuery = useQuery({
    queryKey: qk.reviewQueue(channelId ?? 'sem-canal'),
    queryFn: () => api.getReviewQueue(channelId as ChannelId),
    enabled: Boolean(channelId),
  });

  const pending = queueQuery.data?.length ?? 0;

  return (
    <header className="sticky top-0 z-40 h-[var(--ams-topbar-h)] border-b border-line bg-deep/70 backdrop-blur-[18px]">
      <div className="mx-auto max-w-[1400px] h-full px-4 sm:px-6 lg:px-8 flex items-center gap-3">
        <Link to="/portfolio" className="flex items-center gap-2.5 shrink-0" aria-label="AI Media Studio — início">
          <span className="ams-tile ams-tile--blue" style={{ width: 34, height: 34, borderRadius: 10 }}>
            <Sparkles size={18} />
          </span>
          <span className="leading-tight">
            <span className="block text-[14px] font-bold text-ink">AI Media Studio</span>
            <span className="hidden sm:block text-[10px] text-ink-3">o seu estúdio de mídia com IA</span>
          </span>
        </Link>

        <span className="flex-1" />

        {channelId && (
          <Link
            to={`/c/${channelId}/conteudo?filtro=revisao`}
            className="ams-btn !min-h-[34px] !px-3 relative"
            aria-label={
              pending > 0
                ? `${pending} conteúdos aguardando sua aprovação`
                : 'Nenhum conteúdo aguardando aprovação'
            }
          >
            <Bell size={15} aria-hidden="true" />
            <span className="hidden sm:inline text-[12px]">Aprovações</span>
            {pending > 0 && (
              <span
                className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-[999px] text-[10px] font-bold text-white flex items-center justify-center ams-num"
                style={{ background: 'var(--ams-warn)' }}
              >
                {pending}
              </span>
            )}
          </Link>
        )}

        <ChannelSwitcher currentChannelId={channelId} />
      </div>
    </header>
  );
}
