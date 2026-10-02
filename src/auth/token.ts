/**
 * Sessão do navegador — o **ID token** do Google e nada mais.
 *
 * O `ADR-014` é explícito: o token vive **em memória do processo** (uma variável de módulo), nunca em
 * `localStorage`, `sessionStorage`, cookie ou URL. As três razões, em ordem de gravidade:
 *
 * 1. **`localStorage` é legível por qualquer script da página.** Um XSS — inclusive por dependência
 *    comprometida — levaria a credencial embora. Em memória, o pior caso é a aba atual.
 * 2. **O CSP deste projeto existe** (`ADR-008`) para que injeção de script seja difícil; guardar a
 *    credencial num lugar que só serve para injeção seria torcer contra a própria defesa.
 * 3. **Credencial em URL acaba em log de servidor e histórico.** Em cookie, reabriria o CSRF que o
 *    desenho com header `Authorization` não tem.
 *
 * O preço aceito é honesto e declarado: **recarregar a página desloga**. O Google Identity Services
 * consegue reobter a credencial sem interação no retorno (é o que o botão faz ao reaparecer), então o
 * custo real é um clique ocasional, não redigitar nada.
 *
 * Este arquivo é deliberadamente burro — set, get, clear, aviso de sessão perdida. Quem decide
 * quando entrar e sair é o contexto React (`context.tsx`), e quem usa o token são os clientes de
 * `fetch` (`src/ai/client.ts`, `src/media/client.ts`), que não têm acesso ao contexto do React.
 */

/** Token atual, ou `null` quando não há sessão. */
let accessToken: string | null = null;

/** Quem precisa saber que a sessão acabou (o contexto React assina isto). */
type SessionListener = () => void;
const listeners = new Set<SessionListener>();

/** Guarda a credencial. `null` encerra a sessão. */
export function setAccessToken(token: string | null): void {
  accessToken = token === null || token.trim().length === 0 ? null : token;
}

/** Credencial atual, ou `null`. Não lança: há chamadas legítimas que só querem saber. */
export function getAccessToken(): string | null {
  return accessToken;
}

/**
 * Erro de "não há sessão".
 *
 * Existe como tipo próprio porque **não** é falha de servidor nem de rede: é o app recusando mandar
 * um pedido anônimo para uma rota que exige identidade. Tratar isso como erro genérico faria a tela
 * dizer "não foi possível falar com o servidor" — e o usuário procuraria defeito onde não há.
 */
export class SemSessaoError extends Error {
  readonly code = 'sem-sessao';

  constructor(message = 'Sua sessão terminou. Entre de novo com a sua conta Google para continuar.') {
    super(message);
    this.name = 'SemSessaoError';
  }
}

/** Cabeçalhos de autorização da sessão atual. Vazio quando não há sessão. */
export function authHeaders(): Record<string, string> {
  return accessToken === null ? {} : { authorization: `Bearer ${accessToken}` };
}

/** Igual a `authHeaders`, mas recusa quando não há sessão — o que as rotas protegidas exigem. */
export function requireAuthHeaders(): Record<string, string> {
  if (accessToken === null) throw new SemSessaoError();
  return { authorization: `Bearer ${accessToken}` };
}

/** Assina o aviso de sessão perdida. Devolve a função que cancela a assinatura. */
export function onSessionLost(listener: SessionListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Avisa que o servidor recusou a credencial (HTTP 401).
 *
 * Chamado pelos clientes de `fetch` quando a resposta é 401, ou seja, quando o token expirou ou foi
 * revogado. A consequência é a única honesta: a sessão em memória é descartada e a tela volta para a
 * entrada. Continuar com um token que o servidor já recusou faria cada clique virar outro erro.
 */
export function notifySessionLost(): void {
  accessToken = null;
  for (const listener of listeners) listener();
}

/** Só para teste: limpa sessão e assinantes entre casos. */
export function resetSessionForTests(): void {
  accessToken = null;
  listeners.clear();
}
