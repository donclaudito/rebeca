/**
 * O canal ativo vive **na URL** (`/c/:channelId/...`), não em variável de módulo nem em
 * `localStorage`. É a forma mais forte de garantir o invariante nº 2: não existe estado de canal
 * "fora do canal", e um link sem canal simplesmente não navega.
 */

import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { api, qk } from '@/data/client';
import type { Channel, ChannelId } from '@/data/types';

export function useChannelId(): ChannelId {
  const { channelId } = useParams<{ channelId: string }>();
  if (!channelId) {
    throw new Error('Rota sem canal: toda tela de canal precisa de /c/:channelId.');
  }
  return channelId;
}

/** Canal ativo, sempre lido do servidor por id — nunca herdado da tela anterior. */
export function useActiveChannel(): {
  channelId: ChannelId;
  channel: Channel | undefined;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
} {
  const channelId = useChannelId();
  const query = useQuery({
    queryKey: qk.channel(channelId),
    queryFn: () => api.getChannel(channelId),
  });

  return {
    channelId,
    channel: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: () => {
      void query.refetch();
    },
  };
}
