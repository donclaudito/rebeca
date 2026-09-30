import { NavLink } from 'react-router-dom';
import {
  CalendarDays,
  ChartColumn,
  Compass,
  LayoutDashboard,
  Layers,
  Library,
  Palette,
  Settings,
  Wallet,
} from 'lucide-react';
import { IconTile } from '@/components/ui/primitives';
import type { ChannelId } from '@/data/types';

interface NavEntry {
  to: string;
  label: string;
  icon: React.ReactNode;
  /** Só os 5 primeiros vão para a barra inferior do celular. */
  mobile: boolean;
}

function channelNav(channelId: ChannelId): NavEntry[] {
  return [
    { to: `/c/${channelId}/inicio`, label: 'Início', icon: <LayoutDashboard size={17} />, mobile: true },
    { to: `/c/${channelId}/conteudo`, label: 'Conteúdo', icon: <Library size={17} />, mobile: true },
    { to: `/c/${channelId}/calendario`, label: 'Calendário', icon: <CalendarDays size={17} />, mobile: true },
    { to: `/c/${channelId}/identidade`, label: 'Identidade', icon: <Palette size={17} />, mobile: false },
    { to: `/c/${channelId}/analytics`, label: 'Analytics', icon: <ChartColumn size={17} />, mobile: true },
    { to: `/c/${channelId}/monetizacao`, label: 'Monetização', icon: <Wallet size={17} />, mobile: true },
  ];
}

const globalNav: NavEntry[] = [
  { to: '/portfolio', label: 'Portfólio', icon: <Layers size={17} />, mobile: false },
  { to: '/como-funciona', label: 'Como funciona', icon: <Compass size={17} />, mobile: false },
];

interface SidebarProps {
  channelId?: ChannelId;
}

export function Sidebar({ channelId }: SidebarProps) {
  const primary = channelId ? channelNav(channelId) : [];
  const settings: NavEntry[] = channelId
    ? [{ to: `/c/${channelId}/configuracoes`, label: 'Configurações', icon: <Settings size={17} />, mobile: false }]
    : [];
  const mobileItems = primary.filter((entry) => entry.mobile);

  return (
    <>
      {/* Desktop */}
      <aside
        className="hidden lg:flex flex-col gap-1 w-[var(--ams-sidebar-w)] shrink-0 p-3 self-start sticky top-[calc(var(--ams-topbar-h)+16px)]"
        aria-label="Navegação principal"
      >
        <div className="ams-card ams-card--flush p-2 flex flex-col gap-1">
          {primary.map((entry) => (
            <SidebarLink key={entry.to} entry={entry} />
          ))}
        </div>

        <div className="ams-card ams-card--flush p-2 flex flex-col gap-1 mt-2">
          {globalNav.map((entry) => (
            <SidebarLink key={entry.to} entry={entry} />
          ))}
        </div>

        <div className="flex-1" />

        {settings.length > 0 && (
          <div className="ams-card ams-card--flush p-2 flex flex-col gap-1">
            {settings.map((entry) => (
              <SidebarLink key={entry.to} entry={entry} />
            ))}
          </div>
        )}
      </aside>

      {/* Celular: o app é usado no celular para revisar e aprovar (docs/03 §5). */}
      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t border-line bg-deep/85 backdrop-blur-[18px] px-2 pb-[env(safe-area-inset-bottom)]"
        aria-label="Navegação principal"
      >
        <ul className="flex items-stretch justify-between">
          {(mobileItems.length > 0 ? mobileItems : globalNav).map((entry) => (
            <li key={entry.to} className="flex-1">
              <NavLink
                to={entry.to}
                className="flex flex-col items-center gap-1 py-2.5 text-[10px] font-semibold text-ink-3 aria-[current=page]:text-ink"
              >
                <IconTile tone="blue" size="sm">
                  {entry.icon}
                </IconTile>
                {entry.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}

function SidebarLink({ entry }: { entry: NavEntry }) {
  return (
    <NavLink to={entry.to} className="ams-nav-item">
      <span className="text-ink-3" aria-hidden="true">
        {entry.icon}
      </span>
      {entry.label}
    </NavLink>
  );
}
