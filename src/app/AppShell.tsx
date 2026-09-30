import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { ShellProvider } from './shell';
import type { ChannelId } from '@/data/types';

interface AppShellProps {
  channelId?: ChannelId;
  children: ReactNode;
}

/**
 * Casca do app no modelo do YouTube (docs/03 §5): masthead no topo, **barra lateral esquerda**
 * e o conteúdo ocupando o resto da largura.
 *
 * O conteúdo recebe `key={channelId}` para **remontar** na troca de canal: nenhum estado local de
 * tela sobrevive à troca, o que fecha a porta para dado do canal anterior aparecer por um frame.
 *
 * O `ShellProvider` mora aqui (e não em `main.tsx`) para que a casca seja autossuficiente: quem
 * renderiza a casca tem o estado das duas barras laterais, inclusive nos testes que montam as
 * rotas direto.
 */
export function AppShell({ channelId, children }: AppShellProps) {
  return (
    <ShellProvider>
      <div className="min-h-dvh flex flex-col bg-bg">
        <Topbar channelId={channelId} />
        <div className="flex flex-1 min-h-0">
          <Sidebar channelId={channelId} />
          <main key={channelId ?? 'global'} className="min-w-0 flex-1">
            <div className="mx-auto w-full max-w-[var(--ams-content-max)] px-4 sm:px-6 py-5 pb-24 lg:pb-8">
              {children}
            </div>
          </main>
        </div>
      </div>
    </ShellProvider>
  );
}
