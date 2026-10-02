/**
 * Estado da sessão no React.
 *
 * Cinco estados, e a diferença entre eles é o que a tela precisa dizer:
 *
 * | Estado | Significado | O que a tela mostra |
 * |---|---|---|
 * | `carregando` | perguntando ao servidor se dá para entrar | espera |
 * | `sem-configuracao` | o servidor não tem `GOOGLE_CLIENT_ID` | o que falta configurar |
 * | `anonimo` | ninguém entrou | o botão do Google |
 * | `nao-autorizado` | entrou no Google, mas o `sub` não está na lista | o `sub` para copiar |
 * | `autorizado` | pode usar as rotas que gastam | o app |
 *
 * Ter `nao-autorizado` como estado próprio (e não como erro) é a decisão que evita o beco sem saída:
 * é o estado normal do **primeiro** login, em que o dono ainda não sabia o próprio `sub`. Tratá-lo
 * como falha faria a tela dizer "acesso negado" e não oferecer o único caminho que destrava.
 *
 * A sessão vive em `token.ts` (memória) e **não** neste contexto: quem usa o token são os clientes de
 * `fetch`, que não são componentes React. Aqui só se decide quando entrar e quando sair.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { AuthRequestError, fetchAuthConfig, fetchMe } from './client';
import { forgetGoogleAccount } from './google';
import type { AuthenticatedIdentity } from './contract';
import { onSessionLost, setAccessToken } from './token';

export type AuthStatus = 'carregando' | 'sem-configuracao' | 'anonimo' | 'nao-autorizado' | 'autorizado';

export interface AuthState {
  readonly status: AuthStatus;
  readonly identity: AuthenticatedIdentity | null;
  /** Client ID público do servidor, ou `null` quando não há configuração de autenticação. */
  readonly clientId: string | null;
  /** Quantas identidades o servidor autoriza — nunca quais. */
  readonly allowedIdentities: number;
  /** Mensagem para a tela de entrada (falha de rede, biblioteca bloqueada, sessão expirada…). */
  readonly aviso: string | null;
}

export interface AuthContextValue extends AuthState {
  /** Entra com a credencial devolvida pelo Google. */
  readonly signIn: (credential: string) => Promise<void>;
  readonly signOut: () => void;
  /** Tenta de novo a conversa com o servidor (usado quando ela falhou). */
  readonly reload: () => void;
  /** Mensagem de falha do carregamento do botão, vinda de `google.ts`. */
  readonly reportarAviso: (message: string) => void;
}

const ESTADO_INICIAL: AuthState = {
  status: 'carregando',
  identity: null,
  clientId: null,
  allowedIdentities: 0,
  aviso: null,
};

const AuthContext = createContext<AuthContextValue | null>(null);

function mensagemDe(error: unknown): string {
  if (error instanceof AuthRequestError || error instanceof Error) return error.message;
  return 'Não foi possível falar com o servidor de autenticação.';
}

export function AuthProvider({ children }: { readonly children: ReactNode }) {
  const [state, setState] = useState<AuthState>(ESTADO_INICIAL);

  const carregarConfiguracao = useCallback(async () => {
    setState((atual) => ({ ...atual, status: 'carregando', aviso: null }));
    try {
      const config = await fetchAuthConfig();
      setState({
        status: config.clientId === null ? 'sem-configuracao' : 'anonimo',
        identity: null,
        clientId: config.clientId,
        // Quantas identidades existem só se sabe **depois** de entrar (`/api/auth/me`): a rota pública
        // não expõe isso desde o `QA-014`.
        allowedIdentities: 0,
        aviso: null,
      });
    } catch (error) {
      /*
       * Falha ao ler a configuração é **erro**, não "sem configuração": a diferença importa porque
       * uma diz "falta uma variável no servidor" e a outra diz "não consegui perguntar". O app já
       * pagou caro por confundir as duas uma vez (o painel de IA que ficava carregando para sempre).
       */
      setState({
        status: 'anonimo',
        identity: null,
        clientId: null,
        allowedIdentities: 0,
        aviso: mensagemDe(error),
      });
    }
  }, []);

  useEffect(() => {
    void carregarConfiguracao();
  }, [carregarConfiguracao]);

  useEffect(
    () =>
      onSessionLost(() => {
        setState((atual) => ({
          ...atual,
          status: 'anonimo',
          identity: null,
          aviso: 'Sua sessão expirou. Entre de novo com a sua conta Google para continuar.',
        }));
      }),
    [],
  );

  const signIn = useCallback(async (credential: string) => {
    setState((atual) => ({ ...atual, status: 'carregando', aviso: null }));
    setAccessToken(credential);

    try {
      const me = await fetchMe(credential);
      setState((atual) => ({
        status: me.authorized ? 'autorizado' : 'nao-autorizado',
        identity: me.identity,
        clientId: atual.clientId,
        allowedIdentities: me.allowedIdentities,
        aviso: null,
      }));
    } catch (error) {
      // A credencial foi recusada pelo servidor: manter o token em memória faria cada clique virar
      // outro 401. A sessão é descartada e a tela volta para a entrada, dizendo o motivo.
      setAccessToken(null);
      setState((atual) => ({ ...atual, status: 'anonimo', identity: null, aviso: mensagemDe(error) }));
    }
  }, []);

  const signOut = useCallback(() => {
    forgetGoogleAccount();
    setAccessToken(null);
    setState((atual) => ({ ...atual, status: 'anonimo', identity: null, aviso: null }));
  }, []);

  const reportarAviso = useCallback((message: string) => {
    setState((atual) => ({ ...atual, aviso: message }));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, signIn, signOut, reload: () => void carregarConfiguracao(), reportarAviso }),
    [state, signIn, signOut, carregarConfiguracao, reportarAviso],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Estado da sessão. Fora do provider é erro de programação, e falha alto em vez de devolver `null`. */
export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (value === null) {
    throw new Error('useAuth precisa estar dentro de <AuthProvider>.');
  }
  return value;
}
