import { useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  CalendarDays,
  ChartColumn,
  Compass,
  LayoutDashboard,
  Layers,
  Library,
  Palette,
  PanelLeftClose,
  Settings,
  Wallet,
} from 'lucide-react';
import { useShell } from './shell';
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
    { to: `/c/${channelId}/inicio`, label: 'Início', icon: <LayoutDashboard size={22} />, mobile: true },
    { to: `/c/${channelId}/conteudo`, label: 'Conteúdo', icon: <Library size={22} />, mobile: true },
    { to: `/c/${channelId}/calendario`, label: 'Calendário', icon: <CalendarDays size={22} />, mobile: true },
    { to: `/c/${channelId}/identidade`, label: 'Identidade', icon: <Palette size={22} />, mobile: false },
    { to: `/c/${channelId}/analytics`, label: 'Analytics', icon: <ChartColumn size={22} />, mobile: true },
    { to: `/c/${channelId}/monetizacao`, label: 'Monetização', icon: <Wallet size={22} />, mobile: true },
  ];
}

const globalNav: NavEntry[] = [
  { to: '/portfolio', label: 'Portfólio', icon: <Layers size={22} />, mobile: false },
  { to: '/como-funciona', label: 'Como funciona', icon: <Compass size={22} />, mobile: false },
];

interface SidebarProps {
  channelId?: ChannelId;
}

/**
 * Barra lateral esquerda (`docs/03-design-system.md` §5), com **abrir/fechar de verdade**:
 *
 * - `>=1024px`: aberta (240px) ou fechada — fechada ela **some**, não vira trilho de ícones.
 * - `< 1024px`: vira gaveta sobre o conteúdo, fechada também ao navegar.
 *
 * O elemento fica **sempre no DOM** (fechado = `display: none`), porque o botão do masthead
 * aponta para ele em `aria-controls` e um alvo inexistente é referência quebrada.
 *
 * O "X" mora dentro da barra de propósito: quem procura como fechar procura ali, não no canto
 * oposto da tela.
 */
export function Sidebar({ channelId }: SidebarProps) {
  const { guideOpen, drawerOpen, toggleGuide, closeDrawer } = useShell();
  const location = useLocation();

  // Navegou, a gaveta fecha — senão ela cobre justamente a tela que abriu.
  useEffect(() => {
    closeDrawer();
  }, [location.pathname, closeDrawer]);

  const primary = channelId ? channelNav(channelId) : [];
  const settings: NavEntry[] = channelId
    ? [{ to: `/c/${channelId}/configuracoes`, label: 'Configurações', icon: <Settings size={22} />, mobile: false }]
    : [];
  const mobileItems = primary.filter((entry) => entry.mobile);

  const body = (
    <>
      <div className="flex items-center justify-between gap-2 px-4 pt-3 pb-1">
        <span className="ams-stat__label">Navegação</span>
        <button
          type="button"
          className="ams-icon-btn !w-8 !h-8"
          onClick={toggleGuide}
          aria-label="Fechar o menu de navegação"
        >
          <PanelLeftClose size={18} aria-hidden="true" />
        </button>
      </div>

      <nav className="flex flex-col gap-1 p-3 pt-1" aria-label="Navegação principal">
        {primary.map((entry) => (
          <GuideLink key={entry.to} entry={entry} />
        ))}

        {primary.length > 0 && <hr className="my-2 border-0 border-t border-divider" />}

        {globalNav.map((entry) => (
          <GuideLink key={entry.to} entry={entry} />
        ))}

        {settings.length > 0 && (
          <>
            <hr className="my-2 border-0 border-t border-divider" />
            {settings.map((entry) => (
              <GuideLink key={entry.to} entry={entry} />
            ))}
          </>
        )}
      </nav>
    </>
  );

  return (
    <>
      {/* Desktop: aberta (240px) ou fechada — sempre no DOM ----------------- */}
      <aside
        id="barra-lateral-esquerda"
        className={
          guideOpen
            ? 'hidden lg:block shrink-0 self-start sticky top-[var(--ams-topbar-h)] w-[var(--ams-guide-w)] max-h-[calc(100dvh-var(--ams-topbar-h))] overflow-y-auto border-r border-line'
            : 'hidden'
        }
      >
        {body}
      </aside>

      {/* Celular: gaveta sobre o conteúdo --------------------------------- */}
      {drawerOpen && (
        <>
          <div
            className="lg:hidden fixed inset-0 z-40 bg-black/50"
            onClick={closeDrawer}
            aria-hidden="true"
          />
          <div className="lg:hidden fixed top-[var(--ams-topbar-h)] bottom-0 left-0 z-50 w-[var(--ams-guide-w)] max-w-[85vw] overflow-y-auto bg-surface border-r border-line">
            {body}
          </div>
        </>
      )}

      {/* Celular: barra inferior (o modo principal de revisão) ------------ */}
      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t border-line bg-bg/95 backdrop-blur-[var(--ams-blur)] px-1 pb-[env(safe-area-inset-bottom)]"
        aria-label="Navegação principal"
      >
        <ul className="flex items-stretch justify-between">
          {(mobileItems.length > 0 ? mobileItems : globalNav).map((entry) => (
            <li key={entry.to} className="flex-1">
              <NavLink
                to={entry.to}
                className="flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium text-ink-3 no-underline aria-[current=page]:text-ink"
              >
                <span aria-hidden="true">{entry.icon}</span>
                {entry.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}

function GuideLink({ entry }: { entry: NavEntry }) {
  return (
    <NavLink to={entry.to} className="ams-nav-item">
      <span className="shrink-0" aria-hidden="true">
        {entry.icon}
      </span>
      <span className="truncate">{entry.label}</span>
    </NavLink>
  );
}
