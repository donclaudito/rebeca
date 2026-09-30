import { useEffect } from 'react';
import { Outlet, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { AppShell } from './AppShell';

/**
 * Casca das telas de canal.
 *
 * O canal vem da URL e **a limpeza de cache alheio acontece aqui**, não no botão que troca de canal.
 * Assim o invariante nº 2 (isolamento entre canais) vale para qualquer caminho de entrada: seletor,
 * botão voltar, link colado ou edição manual da URL.
 */
export function ChannelLayout() {
  const { channelId } = useParams<{ channelId: string }>();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!channelId) return;
    queryClient.removeQueries({
      predicate: (query) => query.queryKey[0] === 'channel' && query.queryKey[1] !== channelId,
    });
  }, [channelId, queryClient]);

  return (
    <AppShell channelId={channelId}>
      <Outlet />
    </AppShell>
  );
}

/** Casca das telas globais (Portfólio, Como funciona): nenhuma ação de canal aqui. */
export function GlobalLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
