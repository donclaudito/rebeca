import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { queryClient } from '@/app/queryClient';
import { AppRoutes } from '@/app/routes';
import { AuthProvider, useAuth } from '@/auth/context';
import { LoginGate } from '@/auth/LoginGate';

/**
 * App do AI Media Studio.
 *
 * A ordem importa e não é decorativa: `AuthProvider` fica **dentro** do cliente de consultas (para o
 * estado de sessão poder, no futuro, limpar cache ao sair) e **fora** das rotas — o portão precisa
 * existir antes de qualquer tela montar, senão a primeira tela já disparou as consultas que gastam
 * dinheiro antes de alguém provar quem é.
 *
 * `PortaoDeEntrada` é o que garante o invariante: **sem sessão autorizada, nenhuma tela do app
 * monta**. Poderia ser um redirecionamento para `/login`; é uma troca de conteúdo porque uma rota de
 * login é um endereço a mais para contornar e um lugar a mais para esquecer de proteger.
 */
function PortaoDeEntrada({ children }: { readonly children: ReactNode }) {
  const { status } = useAuth();
  if (status === 'autorizado') return <>{children}</>;
  return <LoginGate />;
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <PortaoDeEntrada>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </PortaoDeEntrada>
      </AuthProvider>
    </QueryClientProvider>
  );
}
