/**
 * Contrato de autenticação — o que o navegador e o servidor combinam, num lugar só.
 *
 * Decisão completa em `.rebeca/decisoes/ADR-014-autenticacao-google-id-token.md`: toda rota de
 * `api/**` exige `Authorization: Bearer <ID token do Google>`, o token é obtido pelo **Google Identity
 * Services** e vive **só em memória** no navegador (nunca em `localStorage`/`sessionStorage`), e a
 * identidade que autoriza é o **`sub`** — não o e-mail.
 *
 * Por que este arquivo existe separado: é o único que os **dois lados** importam. O servidor
 * (`server/auth/*`) e o navegador (`src/auth/*`) precisam concordar sobre o formato do erro e sobre o
 * que cada resposta traz; se cada lado declarasse o seu, o dia em que um mudasse o outro quebraria em
 * silêncio — exatamente o defeito de "contrato de um lado só" que já apareceu neste projeto com o
 * parâmetro `?aberto=`.
 *
 * Nada aqui é segredo. O Client ID é público por definição (vai no bundle do navegador, é o `aud` que
 * o servidor confere); o que autoriza é a lista de `sub`, que **nunca** sai do servidor.
 */

/** Prefixo das rotas de autenticação. São as duas únicas rotas que não passam pela guarda de identidade. */
export const AUTH_BASE = '/api/auth';

/**
 * Endereço da biblioteca do Google.
 *
 * Constante, e não configuração: a documentação oficial de setup é explícita em que **hospedar a
 * biblioteca por conta própria não é caso de uso suportado** ("self-hosting … is not a supported use
 * case"). Um endereço configurável aqui seria a porta pela qual alguém serviria uma cópia da
 * biblioteca — e o CSP teria de autorizar o host escolhido.
 */
export const GOOGLE_SCRIPT_URL = 'https://accounts.google.com/gsi/client';

/** Dados do script do Google que o navegador precisa baixar antes de renderizar o botão. */
export const GOOGLE_GSI_ORIGIN = 'https://accounts.google.com';

/**
 * Identidade autenticada, derivada **do token verificado no servidor**.
 *
 * `sub` é o identificador estável da conta Google: único entre todas as contas e nunca reutilizado. É
 * ele que autoriza. `email`/`name`/`picture` existem só para exibição e auditoria — a documentação do
 * Google avisa que uma conta pode ter e-mails diferentes ao longo do tempo, então autorizar por e-mail
 * daria acesso indevido no dia em que o endereço mudasse de dono.
 */
export interface AuthenticatedIdentity {
  readonly sub: string;
  readonly email?: string;
  readonly name?: string;
  readonly picture?: string;
}

/** Resposta de `GET /api/auth/config` — pública de propósito: só traz o Client ID, que é público. */
export interface AuthConfigView {
  /** Client ID do Google, ou `null` quando o servidor não tem `GOOGLE_CLIENT_ID`. */
  readonly clientId: string | null;
  /** Endereço de onde a biblioteca **tem** de vir. */
  readonly googleScriptUrl: string;
}

/**
 * Resposta de `GET /api/auth/me`.
 *
 * Esta rota exige token válido, mas **não** exige estar na lista de acesso — é justamente por ela que
 * o dono descobre o próprio `sub` para colocar em `REBECA_ALLOWED_SUBS`. Ela não revela nada de
 * terceiros: só devolve a identidade de quem apresentou o token.
 */
export interface AuthMeView {
  /** `true` quando o `sub` está na lista de acesso. `false` é resposta legítima, não erro. */
  readonly authorized: boolean;
  readonly identity: AuthenticatedIdentity;
  /**
   * Quantas identidades estão na lista de acesso — **nunca quais**.
   *
   * A contagem só sai **depois** de o token ser verificado. Ela ficava também na rota pública
   * (`/api/auth/config`) e saiu de lá depois do `QA-014`: um visitante anônimo não tem por que saber
   * se o app tem identidades autorizadas, e a tela de entrada não precisa disso — quem entrou e não
   * está na lista recebe a contagem por aqui, que é onde ela tem uso.
   */
  readonly allowedIdentities: number;
}

/** Códigos de recusa da guarda. Cada um tem um significado próprio para a tela saber o que dizer. */
export type AuthErrorCode =
  /** Nenhum header `Authorization`, ou sem o esquema `Bearer`. */
  | 'token-ausente'
  /** Token apresentado, mas assinatura/`aud`/`iss`/`exp` não conferem. */
  | 'token-invalido'
  /** Token válido de conta que **não** está em `REBECA_ALLOWED_SUBS`. */
  | 'conta-nao-autorizada'
  /** O servidor não tem `GOOGLE_CLIENT_ID`: não há como verificar token nenhum. */
  | 'autenticacao-nao-configurada'
  /** Muitas chamadas em pouco tempo para a mesma identidade. */
  | 'limite-de-uso';

/**
 * Corpo de erro da guarda.
 *
 * Tem a mesma forma do erro da camada de IA (`{ code, message, retryable }`) de propósito: os dois
 * clientes do navegador já sabem ler isso, e um terceiro formato só criaria mais um caminho de
 * tratamento para o mesmo sintoma.
 */
export interface AuthErrorBody {
  readonly code: AuthErrorCode;
  readonly message: string;
  readonly retryable: boolean;
  /** Detalhe técnico **sem segredo** — ajuda a diagnosticar sem vazar token. */
  readonly detail?: string;
}

/** Resposta pública de `GET /api/auth/config` quando o servidor não consegue montar a configuração. */
export const AUTH_NOT_CONFIGURED_MESSAGE =
  'A autenticação não está configurada neste servidor: falta a variável GOOGLE_CLIENT_ID. ' +
  'Sem ela não há como verificar o token do Google, e nenhuma rota de IA ou de mídia responde.';

/** Recusa padrão para token ausente — mensagem única, para não existir texto divergente por rota. */
export const AUTH_MISSING_TOKEN_MESSAGE =
  'Esta rota exige identidade. Entre com a sua conta Google e o app reenviará o pedido com a credencial.';

/** Recusa padrão para token inválido. Não diz **qual** checagem falhou: isso ajudaria a forjar token. */
export const AUTH_INVALID_TOKEN_MESSAGE =
  'A credencial apresentada não é válida (assinatura, público, emissor ou validade). Entre de novo para obter uma nova.';
