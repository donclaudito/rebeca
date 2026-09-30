/**
 * Hooks de dados. Todos recebem `channelId` como primeiro argumento — não existe hook de dado de
 * canal que não saiba de qual canal está falando.
 */

import { useQuery } from '@tanstack/react-query';
import { api, qk } from './client';
import type { ChannelId } from './types';

export function useChannels() {
  return useQuery({ queryKey: qk.channels(), queryFn: () => api.listChannels(), staleTime: 5 * 60_000 });
}

export function useChannel(channelId: ChannelId) {
  return useQuery({ queryKey: qk.channel(channelId), queryFn: () => api.getChannel(channelId) });
}

export function useKpis(channelId: ChannelId) {
  return useQuery({ queryKey: qk.kpis(channelId), queryFn: () => api.getKpis(channelId) });
}

export function useContents(channelId: ChannelId) {
  return useQuery({ queryKey: qk.contents(channelId), queryFn: () => api.listContents(channelId) });
}

export function useReviewQueue(channelId: ChannelId) {
  return useQuery({
    queryKey: qk.reviewQueue(channelId),
    queryFn: () => api.getReviewQueue(channelId),
  });
}

export function useContent(channelId: ChannelId, contentId: string) {
  return useQuery({
    queryKey: qk.content(channelId, contentId),
    queryFn: () => api.getContent(channelId, contentId),
  });
}

export function useWeek(channelId: ChannelId) {
  return useQuery({ queryKey: qk.week(channelId), queryFn: () => api.getWeek(channelId) });
}

export function useModules(channelId: ChannelId) {
  return useQuery({ queryKey: qk.modules(channelId), queryFn: () => api.getModules(channelId) });
}

export function useCharacters(channelId: ChannelId) {
  return useQuery({ queryKey: qk.characters(channelId), queryFn: () => api.getCharacters(channelId) });
}

export function useBrandKit(channelId: ChannelId) {
  return useQuery({ queryKey: qk.brand(channelId), queryFn: () => api.getBrandKit(channelId) });
}

export function useRecommendations(channelId: ChannelId) {
  return useQuery({
    queryKey: qk.recommendations(channelId),
    queryFn: () => api.getRecommendations(channelId),
  });
}

export function usePortfolio() {
  return useQuery({ queryKey: qk.portfolio(), queryFn: () => api.getPortfolio() });
}
