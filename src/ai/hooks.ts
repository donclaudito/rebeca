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

import { useMutation, useQuery, type UseMutationResult } from '@tanstack/react-query';
import { fetchAiStatus, generate } from './client';
import type { AiFunctionId, AiResult } from './contract';
import type { ChannelId } from '../data/types';

export const aiKeys = {
  status: () => ['ai', 'status'] as const,
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
