import { useCallback, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation } from 'react-router-dom';
import { Check, ChevronDown } from 'lucide-react';
import { api, qk } from '@/data/client';
import { formatCompact } from '@/lib/format';
import { ChannelAvatar, cn } from '@/components/ui/primitives';
import type { ChannelId } from '@/data/types';

interface ChannelSwitcherProps {
  currentChannelId?: ChannelId;
}

/**
 * Seletor de canal — o coração do multi-canal (docs/00-visao-produto.md §4).
 *
 * Duas decisões de implementação que valem registro:
 *
 * 1. A limpeza de cache do canal anterior **não** mora aqui: é responsabilidade do `ChannelLayout`,
 *    que a executa sempre que `channelId` muda — inclusive quando a troca vem do botão voltar, de um
 *    link colado ou de edição manual da URL. Aqui só se cancela o que está em voo.
 * 2. Cada opção é um `<Link>` de verdade (funciona com teclado, meio-clique e leitor de tela), e o
 *    fechamento por clique fora usa um backdrop em vez de listener de `mousedown` no documento. Com
 *    listener, o menu fechava entre o `mousedown` e o `click`, o elemento da opção sumia do DOM e a
 *    troca de canal simplesmente não acontecia.
 */
export function ChannelSwitcher({ currentChannelId }: ChannelSwitcherProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const location = useLocation();

  const channelsQuery = useQuery({
    queryKey: qk.channels(),
    queryFn: () => api.listChannels(),
    staleTime: 5 * 60_000,
  });

  const channels = channelsQuery.data ?? [];
  const current = channels.find((channel) => channel.id === currentChannelId);

  /** Rota de destino mantendo a tela atual do outro lado da troca. */
  const channelPath = useCallback(
    (next: ChannelId) => `/c/${next}${location.pathname.replace(/^\/c\/[^/]+/, '') || '/inicio'}`,
    [location.pathname],
  );

  const prepareSwitch = useCallback(() => {
    setOpen(false);
    // Cancela o que está em voo: resposta do canal antigo não pode chegar depois da troca.
    void queryClient.cancelQueries();
  }, [queryClient]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        className="flex items-center gap-2 h-10 pl-1 pr-1 sm:pr-3 max-w-[280px] rounded-[999px] border border-line bg-transparent hover:bg-surface-hover transition-colors cursor-pointer"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={current ? `Canal ativo: ${current.name}. Trocar de canal` : 'Escolher canal'}
        onClick={() => setOpen((value) => !value)}
      >
        {current ? (
          <>
            <ChannelAvatar
              initials={current.initials}
              size={32}
              label={`Avatar do canal ${current.name}`}
            />
            <span className="hidden sm:block min-w-0 text-left leading-tight">
              <span className="block text-[14px] font-medium text-ink truncate">{current.name}</span>
              <span className="block text-[12px] text-ink-3 truncate">
                {current.kind} · {formatCompact(current.subscribers)} inscritos
              </span>
            </span>
          </>
        ) : (
          <span className="text-[14px] font-medium px-2">Escolher canal</span>
        )}
        <ChevronDown size={16} className="hidden sm:block text-ink-3 shrink-0" aria-hidden="true" />
      </button>

      {open && (
        <>
          {/* Backdrop: fecha o menu sem interferir no clique da opção. */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />

          <div
            className="ams-card ams-card--strong absolute right-0 mt-2 w-[320px] p-2 z-50"
            role="listbox"
            aria-label="Canais"
            onKeyDown={(event) => {
              if (event.key === 'Escape') setOpen(false);
            }}
          >
            <p className="ams-stat__label px-2 py-1.5">Trocar de canal</p>

            {channelsQuery.isLoading && (
              <p className="px-2 py-3 text-[12px] text-ink-3">Carregando canais…</p>
            )}
            {channelsQuery.isError && (
              <p className="px-2 py-3 text-[12px] text-danger" role="alert">
                Não deu para carregar seus canais.
              </p>
            )}

            <ul>
              {channels.map((channel) => {
                const selected = channel.id === currentChannelId;
                return (
                  <li key={channel.id}>
                    <Link
                      to={channelPath(channel.id)}
                      role="option"
                      aria-selected={selected}
                      replace
                      onClick={prepareSwitch}
                      className={cn(
                        'w-full flex items-center gap-2.5 p-2 rounded-[8px] text-left no-underline transition-colors',
                        selected ? 'bg-surface-strong' : 'hover:bg-surface-hover',
                      )}
                    >
                      <ChannelAvatar
                        initials={channel.initials}
                        size={32}
                        label={`Avatar do canal ${channel.name}`}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14px] font-medium text-ink truncate">
                          {channel.name}
                        </span>
                        <span className="block text-[12px] text-ink-3 truncate">
                          {channel.kind} · {formatCompact(channel.subscribers)} inscritos
                        </span>
                      </span>
                      {selected && <Check size={16} className="text-accent shrink-0" aria-hidden="true" />}
                    </Link>
                  </li>
                );
              })}
            </ul>

            <p className="px-2 pt-2 pb-1 text-[12px] text-ink-3 border-t border-line mt-1">
              Você trabalha em um canal por vez, como no YouTube Studio.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
