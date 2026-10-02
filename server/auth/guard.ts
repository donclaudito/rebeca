/**
 * A guarda de identidade — **o ponto único**.
 *
 * O `ADR-014` é explícito sobre por que ela mora aqui, e não em cada rota: oito rotas espalhadas por
 * dois manipuladores significam oito lugares onde esquecer a checagem, e a rota esquecida não falha —
 * ela **funciona**, para qualquer visitante, gastando a chave paga. Um `authorizeRequest` chamado no
 * começo do roteador não tem como ser esquecido por rota nova: quem não chama a guarda não responde
 * nada.
 *
 * Três estados, três respostas, e a diferença entre eles importa:
 *
 * | Situação | Resposta | Por quê |
 * |---|---|---|
 * | Sem token, ou token que não verifica | **401** | não sabemos quem é |
 * | Token válido de conta fora da lista | **403** | sabemos quem é, e não é alguém com acesso |
 * | Servidor sem `GOOGLE_CLIENT_ID` | **503** | não há como verificar token nenhum: falha fechada |
 *
 * O 403 **não** é 401 de propósito: a tela precisa distinguir "entre de novo" de "esta conta não tem
 * acesso — copie o seu identificador e autorize-o", que são ações diferentes para quem está operando.
 */

import {
  AUTH_INVALID_TOKEN_MESSAGE,
  AUTH_MISSING_TOKEN_MESSAGE,
  AUTH_NOT_CONFIGURED_MESSAGE,
  type AuthErrorBody,
  type AuthenticatedIdentity,
} from '../../src/auth/contract.js';
import { allowedSubs, entradasQueNaoSaoSub, isSubAllowed } from './access.js';
import { googleClientId } from './config.js';
import { checkRateLimit, AUTH_RATE_LIMIT, AUTH_RATE_LIMIT_PAID } from './rate-limit.js';
import { verifyGoogleIdToken, type GoogleTokenVerifier } from './verify.js';

/** Tudo o que a guarda precisa saber do pedido. Nada aqui vem do cliente além do header. */
export interface AuthContext {
  /** Header `Authorization` cru da requisição. */
  readonly authorization?: string | null;
  /** Injetado nos testes para fixar o "agora" da validade do token. */
  readonly now?: Date;
  /** Injetado nos testes para verificar sem rede. */
  readonly verify?: GoogleTokenVerifier;
  /**
   * `true` quando a rota aciona provedor (gasta dinheiro).
   *
   * Quem decide é o **roteador**, que conhece o caminho — nunca o corpo do pedido. Serve para aplicar
   * a cota mais apertada (`AUTH_RATE_LIMIT_PAID`) só onde há gasto, e para a leitura não consumir a
   * cota de geração (achado 3 do `QA-014`).
   */
  readonly costly?: boolean;
}

/** Identidade pronta, ou a recusa já no formato que os dois clientes do navegador sabem ler. */
export type AuthOutcome =
  | { readonly ok: true; readonly identity: AuthenticatedIdentity }
  | { readonly ok: false; readonly status: number; readonly body: AuthErrorBody };

/**
 * Extrai o token do header `Authorization`.
 *
 * Aceita exatamente o esquema `Bearer` (sem diferenciar maiúsculas, como manda a RFC 6750). Não
 * aceita token em query string, em cookie nem em corpo: credencial em URL acaba em log de servidor e
 * em histórico de navegador, e cookie reabriria CSRF que o desenho com header não tem.
 */
export function bearerToken(header: string | null | undefined): string | null {
  if (typeof header !== 'string') return null;
  const match = /^Bearer[ \t]+(\S+)$/i.exec(header.trim());
  return match?.[1] ?? null;
}

function recusa(status: number, code: AuthErrorBody['code'], message: string, retryable = false, detail?: string): AuthOutcome {
  return {
    ok: false,
    status,
    body: {
      code,
      message,
      retryable,
      ...(detail === undefined ? {} : { detail }),
    },
  };
}

/**
 * Prova **quem** é — e só isso.
 *
 * É o que `GET /api/auth/me` usa: a rota existe para o dono descobrir o próprio `sub`, então ela não
 * pode exigir que ele já esteja na lista (seria um ciclo fechado). Ela não dá acesso a nada além da
 * própria identidade de quem apresentou o token.
 */
export async function authenticateRequest(context: AuthContext = {}): Promise<AuthOutcome> {
  const clientId = googleClientId();
  if (clientId === null) {
    return recusa(503, 'autenticacao-nao-configurada', AUTH_NOT_CONFIGURED_MESSAGE);
  }

  const token = bearerToken(context.authorization);
  if (token === null) {
    return recusa(401, 'token-ausente', AUTH_MISSING_TOKEN_MESSAGE);
  }

  const verificacao = await verifyGoogleIdToken(token, {
    audience: clientId,
    ...(context.now === undefined ? {} : { now: context.now }),
    ...(context.verify === undefined ? {} : { verify: context.verify }),
  });

  if (!verificacao.ok) {
    // O motivo técnico vai em `detail` (ajuda quem opera a diagnosticar sem expor o token) e a
    // mensagem ao usuário é única: dizer **qual** checagem falhou ensinaria a forjar token.
    return recusa(401, 'token-invalido', AUTH_INVALID_TOKEN_MESSAGE, false, verificacao.reason);
  }

  return { ok: true, identity: verificacao.identity };
}

/**
 * Prova quem é **e** que essa pessoa pode usar as rotas que gastam.
 *
 * É esta que as rotas de `api/ai/*` e `api/media/*` chamam. Além da identidade, aplica a lista de
 * acesso e o limite de uso.
 */
export async function authorizeRequest(context: AuthContext = {}): Promise<AuthOutcome> {
  const autenticacao = await authenticateRequest(context);
  if (!autenticacao.ok) return autenticacao;

  const { identity } = autenticacao;
  const lista = allowedSubs();

  if (!isSubAllowed(identity.sub, lista)) {
    /*
     * A mensagem carrega o **próprio** `sub` de quem perguntou — nunca a lista. É o caminho pelo qual
     * o dono destrava o primeiro acesso: o app publicado não abre, a tela mostra o identificador, ele
     * cola em `REBECA_ALLOWED_SUBS` e recarrega. Sem isso, o 403 seria um beco sem saída.
     */
    const quem = identity.email === undefined ? identity.sub : `${identity.email} (sub ${identity.sub})`;

    /*
     * Diagnóstico do erro provável: e-mail colocado no lugar do `sub`. A lista fica "preenchida", o
     * login funciona, e **toda** chamada devolve 403 — um sintoma que não aponta para a causa. O aviso
     * diz a **natureza** do erro, sem ecoar nenhuma entrada da lista **e sem dizer quantas são**:
     * quem recebe isto autenticou, mas pode não ser o dono (achado 5 do `QA-014`).
     */
    const dica =
      entradasQueNaoSaoSub(lista).length === 0
        ? ''
        : ' A lista configurada parece ter entradas que não parecem número de sub — se houver e-mail ali, ele nunca vai casar: a identidade que autoriza é o sub.';

    return recusa(
      403,
      'conta-nao-autorizada',
      `A conta ${quem} entrou no Google, mas não está na lista de acesso deste app. ` +
        `Adicione esse sub em REBECA_ALLOWED_SUBS (separado por vírgula) e recarregue a página.${dica}`,
    );
  }

  /*
   * O limite é por `sub` — não por IP. IP é compartilhado (NAT) e trivial de trocar; a identidade,
   * não. Ele vem **depois** da lista de acesso de propósito: contar chamadas de quem não pode usá-las
   * gastaria memória do processo com quem não tem acesso a nada.
   *
   * E são **duas cotas independentes** desde o `QA-014`: leitura e geração não dividem o mesmo
   * contador. Antes, desenhar uma tela com 13 prévias aproximava a identidade do teto e o sintoma era
   * `429` em `GET` — que não gasta nada. A chave do contador carrega o nome da política justamente
   * para que consumir leitura não reduza a cota de geração, e vice-versa.
   */
  const paga = context.costly === true;
  const politica = paga ? AUTH_RATE_LIMIT_PAID : AUTH_RATE_LIMIT;
  const limite = checkRateLimit(`${identity.sub}:${paga ? 'geracao' : 'leitura'}`, {
    policy: politica,
    ...(context.now === undefined ? {} : { now: context.now.getTime() }),
  });
  if (!limite.allowed) {
    const segundos = Math.max(1, Math.ceil(limite.retryAfterMs / 1000));
    return recusa(
      429,
      'limite-de-uso',
      `Muitas ${paga ? 'gerações' : 'chamadas'} em pouco tempo. Aguarde ${segundos} segundo(s) e tente de novo. ` +
        'Nada foi gerado e nada foi cobrado.',
      true,
      `janela deslizante por identidade (${paga ? 'geração' : 'leitura'}): ${limite.retryAfterMs}ms restantes`,
    );
  }

  return { ok: true, identity };
}
