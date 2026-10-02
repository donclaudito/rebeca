/**
 * Hooks da mídia gerada.
 *
 * Duas decisões que valem explicação:
 *
 * 1. **A chave de cache carrega o `channelId`.** É o padrão do projeto desde o teste de vazamento entre
 *    canais: cache sem canal é como um canal vê dado de outro. Aqui isso importa mais que na média,
 *    porque a resposta é a **lista de arquivos** de um canal.
 * 2. **`staleTime: 0`.** A mídia muda quando o pipeline roda (`node .tools/render-episodio.mjs`), e o
 *    watcher do Vite ignora `.rebeca/**` de propósito (asset pesado não dispara HMR). Com cache longo, o
 *    humano rodaria o pipeline, voltaria para a tela e veria a lista antiga — que é a mesma mentira de
 *    antes, só mais difícil de notar. Reconsultar é uma leitura local barata.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchContentCost,
  fetchMediaEpisode,
  fetchMediaLibrary,
  generateEpisodeThumbnails,
  type ThumbnailContext,
} from './client';
import type { ChannelId } from '../data/types';

export const mediaKeys = {
  library: (channelId: ChannelId) => ['media', 'library', channelId] as const,
  episode: (channelId: ChannelId, episodeId: string) => ['media', 'episode', channelId, episodeId] as const,
  /** Custo real de um conteúdo. A chave carrega o canal **e** o conteúdo, como todo cache do projeto. */
  cost: (channelId: ChannelId, contentId: string) => ['media', 'cost', channelId, contentId] as const,
};

/** O que existe de mídia para o canal — inclusive quando não existe nada (com o motivo). */
export function useMediaLibrary(channelId: ChannelId) {
  return useQuery({
    queryKey: mediaKeys.library(channelId),
    queryFn: () => fetchMediaLibrary(channelId),
    staleTime: 0,
    retry: 1,
  });
}

/**
 * Um episódio por inteiro.
 *
 * `episodeId === null` **desabilita** a consulta: pedir "o episódio de ninguém" seria uma chamada sem
 * canal de verdade, e a rota recusaria com 400 — erro que a tela mostraria sem que houvesse erro algum.
 */
export function useMediaEpisode(channelId: ChannelId, episodeId: string | null) {
  return useQuery({
    queryKey: mediaKeys.episode(channelId, episodeId ?? ''),
    queryFn: () => fetchMediaEpisode(channelId, episodeId as string),
    enabled: episodeId !== null && episodeId.length > 0,
    staleTime: 0,
    retry: 1,
  });
}

/**
 * Gera as opções de thumbnail.
 *
 * Mutação, não consulta: ela **produz** e pode gastar. E `episodeId` é fixado na criação do hook, pelo
 * mesmo motivo de `useAiFunction` — assim é impossível uma tela pedir geração para o episódio de outro
 * canal por engano, que é o defeito de isolamento mais provável neste produto.
 *
 * Ao terminar, invalida a leitura do episódio e a lista do canal: a mídia que estava na tela deixou de
 * ser a verdade no instante em que os arquivos nasceram.
 */
export function useGenerateThumbnails(channelId: ChannelId, episodeId: string, contexto: ThumbnailContext = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => generateEpisodeThumbnails(channelId, episodeId, contexto),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: mediaKeys.episode(channelId, episodeId) });
      void queryClient.invalidateQueries({ queryKey: mediaKeys.library(channelId) });
    },
  });
}

/**
 * Quanto o conteúdo custou **de verdade**, somado do livro no servidor.
 *
 * `contentId === null` desabilita a consulta, pelo mesmo motivo de `useMediaEpisode`: pedir o custo de
 * conteúdo nenhum seria uma chamada que a rota recusaria com 400 — erro que a tela mostraria sem que
 * houvesse erro algum.
 *
 * `staleTime: 0` porque o número muda enquanto a tela está aberta: **cada** chamada de IA lança uma linha
 * no livro. Com cache longo, o humano geraria o roteiro e continuaria vendo o custo de antes — a mesma
 * família de mentira que esta leitura existe para corrigir.
 */
export function useContentCost(channelId: ChannelId, contentId: string | null) {
  return useQuery({
    queryKey: mediaKeys.cost(channelId, contentId ?? ''),
    queryFn: () => fetchContentCost(channelId, contentId as string),
    enabled: contentId !== null && contentId.length > 0,
    staleTime: 0,
    retry: 1,
  });
}
