import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import type { ChannelId } from '@/data/types';

interface AppShellProps {
  channelId?: ChannelId;
  children: ReactNode;
}

/**
 * Casca do app: fundo, topbar, sidebar e conteúdo (docs/03 §5).
 *
 * O conteúdo recebe `key={channelId}` para **remontar** na troca de canal: nenhum estado local de
 * tela sobrevive à troca, o que fecha a porta para dado do canal anterior aparecer por um frame.
 */
export function AppShell({ channelId, children }: AppShellProps) {
  return (
    <div className="min-h-dvh flex flex-col">
      <Topbar channelId={channelId} />
      <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-8 flex gap-6 pt-5 pb-24 lg:pb-10">
        <Sidebar channelId={channelId} />
        <main key={channelId ?? 'global'} className="min-w-0 flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}
