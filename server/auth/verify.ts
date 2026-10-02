/**
 * Verificação do **ID token** do Google — a única porta pela qual uma identidade entra no sistema.
 *
 * O critério é o da documentação oficial ("Verify the Google ID token on your server side",
 * lida em 2026-10-02): assinatura conferida com as chaves públicas do Google, `aud` igual ao nosso
 * Client ID, `iss` igual a `accounts.google.com` ou `https://accounts.google.com`, e `exp` não
 * vencido. A assinatura é delegada à biblioteca **oficial** (`google-auth-library`,
 * `OAuth2Client.verifyIdToken`), que é a recomendada pela própria documentação para Node.js; a
 * **política** (público, emissor, validade, `sub`) é verificada aqui, de forma explícita, para que
 * ela exista em código nosso — auditável, testável e independente de detalhe interno da biblioteca.
 *
 * Três decisões que valem explicação, porque cada uma fecha um defeito concreto:
 *
 * 1. **A biblioteca é importada dinamicamente.** Carregá-la no topo do módulo faz todo teste de
 *    qualquer rota importar `gaxios`, `jws` e o cliente HTTP do Google; pior, sob `jsdom` o
 *    empacotador pode resolver a variante de navegador da biblioteca, que não tem `OAuth2Client`.
 *    Com `import()` dentro do verificador, o custo e a resolução acontecem só quando há token de
 *    verdade para verificar — e os testes injetam um verificador, sem rede.
 * 2. **A mensagem de erro da biblioteca NUNCA é propagada.** Ela lança, em caminhos reais,
 *    `Wrong number of segments in token: <o token inteiro>`, e o token é a credencial. Toda falha
 *    vira um motivo fixo, sem eco do valor recebido. Há teste para isso.
 * 3. **A tolerância é zero.** A biblioteca já admite folga de relógio; exigir aqui que `exp` esteja no
 *    futuro *segundo o nosso relógio* não afrouxa nada e faz o teste de "token vencido" medir a
 *    nossa checagem, não a da dependência.
 */

import type { AuthenticatedIdentity } from '../../src/auth/contract.js';

/** Emissores aceitos. A documentação lista exatamente estes dois — sem barra e com. */
export const GOOGLE_ISSUERS: readonly string[] = ['accounts.google.com', 'https://accounts.google.com'];

/**
 * Payload do token, como **dado não confiável**.
 *
 * Os campos são `unknown` de propósito: este é o ponto em que bytes vindos de fora entram no
 * sistema. Tipar como `string` aqui seria acreditar na forma antes de conferi-la.
 */
export interface GoogleTokenPayload {
  readonly sub?: unknown;
  readonly aud?: unknown;
  readonly iss?: unknown;
  readonly exp?: unknown;
  readonly email?: unknown;
  readonly name?: unknown;
  readonly picture?: unknown;
}

/**
 * Como o token é verificado.
 *
 * Injetável porque a alternativa é o teste depender de rede e de chave do Google — e teste que
 * depende de credencial real, além de frágil, é teste que um dia **gasta dinheiro de alguém**. O
 * verificador real é o padrão; os testes passam o seu.
 */
export type GoogleTokenVerifier = (idToken: string, audience: string) => Promise<GoogleTokenPayload>;

/** Token maior que isto não é ID token: é corpo estranho, e é recusado antes de qualquer chamada. */
const MAX_TOKEN_CHARS = 8192;

/** Cache do cliente por `audience`: ele guarda as chaves públicas e respeita o `Cache-Control` delas. */
const clients = new Map<string, { verifyIdToken: (options: { idToken: string; audience: string }) => Promise<{ getPayload: () => unknown }> }>();

async function googleClient(audience: string) {
  const cached = clients.get(audience);
  if (cached !== undefined) return cached;

  // `import()` dinâmico — ver decisão nº 1 no cabeçalho. A extensão `.js` não se aplica a pacote
  // (só a caminho relativo), então o especificador fica como está.
  const { OAuth2Client } = await import('google-auth-library');
  const client = new OAuth2Client(audience) as unknown as {
    verifyIdToken: (options: { idToken: string; audience: string }) => Promise<{ getPayload: () => unknown }>;
  };
  clients.set(audience, client);
  return client;
}

/**
 * A verificação **não pôde ser feita** — biblioteca ausente do bundle, por exemplo.
 *
 * Existe como tipo próprio porque confundir isto com "assinatura recusada" produziria o pior
 * diagnóstico possível: o dono veria "credencial inválida" com um login legítimo na mão e procuraria
 * defeito no Google. É a mesma classe do defeito que já derrubou a IA em produção (dependência fora
 * do bundle da função), e essa classe merece nome.
 */
export class VerificacaoIndisponivelError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VerificacaoIndisponivelError';
  }
}

/** Verificador de produção: assinatura conferida pela biblioteca oficial. */
export const verificarComGoogle: GoogleTokenVerifier = async (idToken, audience) => {
  let client: Awaited<ReturnType<typeof googleClient>>;
  try {
    client = await googleClient(audience);
  } catch {
    // Não propagamos a mensagem original: ela pode citar caminho de módulo, e a causa é esta.
    throw new VerificacaoIndisponivelError('a biblioteca de verificação do Google não carregou neste ambiente');
  }

  const ticket = await client.verifyIdToken({ idToken, audience });
  const payload = ticket.getPayload();
  if (payload === null || typeof payload !== 'object') return {};
  return payload as GoogleTokenPayload;
};

/** Resultado da verificação: identidade pronta, ou o motivo técnico da recusa (nunca o token). */
export type TokenVerification =
  | { readonly ok: true; readonly identity: AuthenticatedIdentity }
  | { readonly ok: false; readonly reason: string };

export interface VerifyOptions {
  /** `aud` esperado — o nosso Client ID. */
  readonly audience: string;
  /** Injetado nos testes para fixar o "agora" da checagem de validade. */
  readonly now?: Date;
  /** Injetado nos testes para verificar sem rede. */
  readonly verify?: GoogleTokenVerifier;
}

function texto(valor: unknown): string | null {
  if (typeof valor !== 'string') return null;
  const trimmed = valor.trim();
  return trimmed.length === 0 ? null : trimmed;
}

/**
 * Verifica o token e devolve a identidade — ou o motivo da recusa.
 *
 * A ordem das checagens é da mais barata para a mais cara: formato, depois política, e só então a
 * assinatura (que pode tocar a rede para buscar as chaves, uma vez por rotação).
 */
export async function verifyGoogleIdToken(
  idToken: string,
  options: VerifyOptions,
): Promise<TokenVerification> {
  if (typeof idToken !== 'string' || idToken.length === 0) {
    return { ok: false, reason: 'token vazio' };
  }
  if (idToken.length > MAX_TOKEN_CHARS) {
    return { ok: false, reason: 'token longo demais para ser um ID token' };
  }
  // Um JWT tem exatamente três segmentos. Conferir aqui evita gastar uma chamada de rede em algo que
  // nem tem forma de JWT — e o navegador nunca deveria ter mandado isso.
  if (idToken.split('.').length !== 3) {
    return { ok: false, reason: 'token não tem o formato de JWT (três segmentos)' };
  }

  const verify = options.verify ?? verificarComGoogle;
  let payload: GoogleTokenPayload;
  try {
    payload = await verify(idToken, options.audience);
  } catch (error) {
    /*
     * Sem `error.message`: ver decisão nº 2 — a biblioteca ecoa o token em caminhos reais.
     *
     * A distinção entre "não deu para verificar" e "a assinatura não confere" é feita por **tipo**,
     * não por texto de mensagem: um servidor sem a biblioteca não pode se passar por "token inválido",
     * porque isso mandaria quem opera procurar defeito na conta do Google.
     */
    return {
      ok: false,
      reason:
        error instanceof VerificacaoIndisponivelError
          ? 'verificação indisponível: a biblioteca do Google não carregou neste ambiente'
          : 'assinatura recusada (chave pública do Google não valida este token)',
    };
  }

  if (payload === null || typeof payload !== 'object') {
    return { ok: false, reason: 'token sem payload' };
  }

  const sub = texto(payload.sub);
  if (sub === null) return { ok: false, reason: 'token sem "sub"' };

  // `aud` pode vir como lista em token de aplicativo; o nosso cliente emite string. Aceitar as duas
  // formas é o correto, e exigir que a lista **contenha** o nosso Client ID evita o furo de aceitar
  // um token emitido para outro aplicativo.
  const aud = payload.aud;
  const audOk =
    typeof aud === 'string' ? aud === options.audience : Array.isArray(aud) && aud.includes(options.audience);
  if (!audOk) return { ok: false, reason: 'token emitido para outro público (aud)' };

  const iss = texto(payload.iss);
  if (iss === null || !GOOGLE_ISSUERS.includes(iss)) {
    return { ok: false, reason: 'emissor (iss) não é o Google' };
  }

  const exp = typeof payload.exp === 'number' ? payload.exp : Number.NaN;
  const agora = (options.now ?? new Date()).getTime() / 1000;
  if (!Number.isFinite(exp) || exp <= agora) {
    return { ok: false, reason: 'token vencido' };
  }

  const email = texto(payload.email);
  const name = texto(payload.name);
  const picture = texto(payload.picture);

  return {
    ok: true,
    identity: {
      sub,
      ...(email === null ? {} : { email }),
      ...(name === null ? {} : { name }),
      ...(picture === null ? {} : { picture }),
    },
  };
}

/** Só para teste: descarta o cache de clientes entre casos. */
export function resetGoogleClients(): void {
  clients.clear();
}
