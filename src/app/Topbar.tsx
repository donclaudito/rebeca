import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bell, Menu, Moon, PanelRightClose, PanelRightOpen, Search, Sun, X } from 'lucide-react';
import { api, qk } from '@/data/client';
import { useShell } from './shell';
import { useTheme } from './theme';
import { ChannelSwitcher } from './ChannelSwitcher';
import type { ChannelId } from '@/data/types';

interface TopbarProps {
  channelId?: ChannelId;
}

/**
 * Masthead no modelo do YouTube (`docs/03-design-system.md` §5): hambúrguer, marca,
 * **busca no centro** e as ações à direita.
 *
 * Ele carrega os **dois** controles das barras laterais: o hambúrguer abre/fecha a barra
 * esquerda e o botão de painel abre/fecha a direita. Os dois dizem o estado em
 * `aria-expanded` e apontam para a barra que controlam em `aria-controls`.
 *
 * A busca não é enfeite: ela filtra a biblioteca do canal em `/c/:id/conteudo?busca=…`
 * — uma caixa de busca que não busca é bug, não decoração.
 */
export function Topbar({ channelId }: TopbarProps) {
  const { guideOpen, toggleGuide, rightOpen, toggleRight } = useShell();
  const { theme, toggle: toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [term, setTerm] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);

  const queueQuery = useQuery({
    queryKey: qk.reviewQueue(channelId ?? 'sem-canal'),
    queryFn: () => api.getReviewQueue(channelId as ChannelId),
    enabled: Boolean(channelId),
  });

  const pending = queueQuery.data?.length ?? 0;

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    if (!channelId) return;
    const trimmed = term.trim();
    navigate(
      trimmed
        ? `/c/${channelId}/conteudo?busca=${encodeURIComponent(trimmed)}`
        : `/c/${channelId}/conteudo`,
    );
    setSearchOpen(false);
  }

  const searchField = (
    <form role="search" className="ams-search" onSubmit={submitSearch}>
      <label className="sr-only" htmlFor="busca-canal">
        Buscar conteúdo deste canal
      </label>
      <input
        id="busca-canal"
        type="search"
        value={term}
        onChange={(event) => setTerm(event.target.value)}
        placeholder="Buscar conteúdo do canal"
        className="ams-search__field"
        autoComplete="off"
      />
      <button type="submit" className="ams-search__submit" aria-label="Buscar">
        <Search size={18} aria-hidden="true" />
      </button>
    </form>
  );

  return (
    <header className="sticky top-0 z-40 bg-bg/95 backdrop-blur-[var(--ams-blur)] border-b border-line">
      <div className="mx-auto max-w-[var(--ams-content-max)] h-[var(--ams-topbar-h)] px-2 sm:px-4 flex items-center gap-1 sm:gap-2">
        {/* Esquerda: barra de navegação + marca ----------------------------- */}
        {/* Nome acessível constante + `aria-expanded`: é o padrão de divulgação, e o
            estado vai no atributo em vez de trocar o nome do botão a cada clique. */}
        <button
          type="button"
          className="ams-icon-btn"
          onClick={toggleGuide}
          aria-expanded={guideOpen}
          aria-controls="barra-lateral-esquerda"
          aria-label="Menu de navegação"
        >
          <Menu size={20} aria-hidden="true" />
        </button>

        <Link
          to="/portfolio"
          className="flex items-center gap-1.5 shrink-0 no-underline"
          aria-label="AI Media Studio — ir para o portfólio"
        >
          <span className="ams-logo-mark">
            <img src="/icone-96.png" alt="" width={32} height={32} />
          </span>
          <span className="hidden sm:block ams-font-display text-[18px] font-semibold tracking-[-0.02em] text-ink">
            AI Media Studio
          </span>
        </Link>

        {/* Centro: busca (some no celular, onde vira uma linha própria) ----- */}
        {channelId && (
          <div className="hidden md:flex flex-1 justify-center px-4 min-w-0">
            <div className="w-full max-w-[600px]">{searchField}</div>
          </div>
        )}

        <span className="flex-1 md:hidden" />

        {/* Direita: ações --------------------------------------------------- */}
        <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
          {channelId && (
            <button
              type="button"
              className="ams-icon-btn md:hidden"
              onClick={() => setSearchOpen((value) => !value)}
              aria-label={searchOpen ? 'Fechar busca' : 'Buscar conteúdo do canal'}
              aria-expanded={searchOpen}
            >
              {searchOpen ? <X size={20} aria-hidden="true" /> : <Search size={20} aria-hidden="true" />}
            </button>
          )}

          {channelId && (
            <Link
              to={`/c/${channelId}/conteudo?filtro=revisao`}
              className="ams-icon-btn relative"
              aria-label={
                pending > 0
                  ? `${pending} conteúdos aguardando sua aprovação`
                  : 'Nenhum conteúdo aguardando aprovação'
              }
            >
              <Bell size={20} aria-hidden="true" />
              {pending > 0 && (
                <span className="ams-badge">{pending}</span>
              )}
            </Link>
          )}

          {/* Barra lateral direita: só existe como barra a partir de lg (ver shell.tsx),
              então no celular o botão fica escondido em vez de prometer o que não faz. */}
          <button
            type="button"
            className="ams-icon-btn hidden lg:inline-flex"
            onClick={toggleRight}
            aria-expanded={rightOpen}
            aria-controls="barra-lateral-direita"
            aria-label="Painel lateral"
          >
            {rightOpen ? (
              <PanelRightClose size={20} aria-hidden="true" />
            ) : (
              <PanelRightOpen size={20} aria-hidden="true" />
            )}
          </button>

          <button
            type="button"
            className="ams-icon-btn"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Mudar para o tema claro' : 'Mudar para o tema escuro'}
          >
            {theme === 'dark' ? <Sun size={20} aria-hidden="true" /> : <Moon size={20} aria-hidden="true" />}
          </button>

          <ChannelSwitcher currentChannelId={channelId} />
        </div>
      </div>

      {/* Celular: a busca ocupa uma linha inteira, como no app do YouTube. */}
      {channelId && searchOpen && (
        <div className="md:hidden px-2 pb-2">
          {searchField}
        </div>
      )}
    </header>
  );
}
