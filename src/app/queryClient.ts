import { QueryClient } from '@tanstack/react-query';

/**
 * Cache do cliente. `staleTime` curto porque no protótipo a fonte é local; quando vier a API real,
 * o ajuste é aqui e em nenhum outro lugar.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 15_000,
      refetchOnWindowFocus: false,
    },
  },
});
