/**
 * Hooks de IA.
 *
 * `useAiFunction` devolve uma mutação com o estado que a tela precisa mostrar — pendente, erro,
 * resultado — e nada além disso. Em particular, **não** há hook que grave o resultado no conteúdo:
 * a saída da IA chega para ser lida pelo humano, e quem decide transformá-la em rascunho é ele
 * (AGENTS.md, invariante nº 1).
 *
 * A chave de cache do status é global de propósito: configuração de provedor não pertence a um
 * canal. Tudo o que é escopo de conteúdo carrega `channelId` — e a chamada sempre leva o canal no
 * corpo, nunca só no cache.
 */

import { useMutation, useQuery, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { fetchSettings, fetchAiStatus, generate, saveSettings, testProvider } from './client';
import type { AiFunctionId, AiResult, AiSettingsPatch } from './contract';
import type { ChannelId } from '../data/types';

export const aiKeys = {
  status: () => ['ai', 'status'] as const,
  settings: () => ['ai', 'settings'] as const,
};

export function useAiStatus() {
  return useQuery({
    queryKey: aiKeys.status(),
    queryFn: fetchAiStatus,
    // O status muda quando alguém configura uma chave e reinicia o servidor; não vale reconsultar a
    // cada foco de janela, mas também não pode ficar velho a sessão inteira.
    staleTime: 60_000,
    retry: 1,
  });
}

/** Configuração de IA: chaves (mascaradas), endereços e escolha de modelo. */
export function useAiSettings() {
  return useQuery({
    queryKey: aiKeys.settings(),
    queryFn: fetchSettings,
    // A tela de Configurações é onde o usuário mexe nisto; manter fresco evita mostrar estado velho
    // logo depois de salvar em outra aba.
    staleTime: 0,
    retry: 1,
  });
}

/** Grava a configuração. Devolve também a configuração já atualizada, para a tela não piscar. */
export function useSaveAiSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: AiSettingsPatch) => saveSettings(patch),
    onSuccess: (result) => {
      // Escreve o resultado direto no cache: evita uma segunda ida ao servidor e evita a tela
      // mostrar o estado antigo por um instante depois de salvar.
      queryClient.setQueryData(aiKeys.settings(), result.settings);
      void queryClient.invalidateQueries({ queryKey: aiKeys.status() });
    },
  });
}

/** Testa a conexão de um provedor (chamada mínima real, com custo registrado). */
export function useTestProvider() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (provider: string) => testProvider(provider),
    onSuccess: () => {
      // O teste grava custo real no livro — o painel de gasto precisa refletir isso.
      void queryClient.invalidateQueries({ queryKey: aiKeys.settings() });
      void queryClient.invalidateQueries({ queryKey: aiKeys.status() });
    },
  });
}

export interface RunAiOptions {
  readonly contentId?: string;
  readonly note?: string;
}

export type AiMutation = UseMutationResult<AiResult, Error, { input: Record<string, unknown>; options?: RunAiOptions }>;

/**
 * Executa uma função de IA para um canal.
 *
 * `functionId` e `channelId` são fixados na criação do hook: assim é impossível uma tela chamar a
 * função de um canal com o canal de outro — o defeito de isolamento mais provável neste produto.
 */
export function useAiFunction(
  functionId: AiFunctionId,
  channelId: ChannelId,
  options: RunAiOptions = {},
): AiMutation {
  return useMutation<AiResult, Error, { input: Record<string, unknown>; options?: RunAiOptions }>({
    mutationFn: ({ input, options: perCall }) =>
      generate({
        functionId,
        channelId,
        input,
        ...(perCall?.contentId ?? options.contentId ? { contentId: perCall?.contentId ?? options.contentId } : {}),
        ...(perCall?.note ?? options.note ? { note: perCall?.note ?? options.note } : {}),
      }),
  });
}
