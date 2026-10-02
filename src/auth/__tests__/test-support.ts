/**
 * Apoio aos testes de autenticação.
 *
 * Duas coisas que este arquivo existe para garantir:
 *
 * 1. **Nenhum teste depende da rede nem de credencial real.** O verificador de token é injetado
 *    (`GoogleTokenVerifier`), então o caminho de política — `aud`, `iss`, `exp`, `sub`, lista de
 *    acesso — é exercitado de verdade, e a assinatura (que buscaria as chaves do Google) não é
 *    tocada. Teste que depende de credencial real é teste que um dia gasta dinheiro de alguém; o
 *    projeto já corrigiu esse defeito uma vez na camada de IA.
 * 2. **O ambiente é isolado por caso.** `GOOGLE_CLIENT_ID` e `REBECA_ALLOWED_SUBS` são restaurados ao
 *    valor anterior: uma variável deixada para trás faria o caso seguinte passar por motivo errado.
 */

import type { GoogleTokenPayload, GoogleTokenVerifier } from '../../../server/auth/verify.js';

/** Client ID fictício usado como `aud` nos testes. */
export const CLIENT_ID_DE_TESTE = 'test-client-id.apps.googleusercontent.com';

/** `sub` de uma conta autorizada — número, como os `sub` reais do Google. */
export const SUB_AUTORIZADO = '102938475610293847561';

/** `sub` de uma conta autenticada e **não** autorizada. */
export const SUB_NAO_AUTORIZADO = '998877665544332211000';

/** Token com forma de JWT. O conteúdo não importa: quem decide é o verificador injetado. */
export const TOKEN_DE_TESTE = 'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ0ZXN0ZSJ9.assinatura';

/** Payload que o verificador devolve quando nada é sobrescrito: token legítimo do cliente de teste. */
export function payloadDeTeste(overrides: Partial<GoogleTokenPayload> = {}): GoogleTokenPayload {
  return {
    sub: SUB_AUTORIZADO,
    aud: CLIENT_ID_DE_TESTE,
    iss: 'https://accounts.google.com',
    exp: Math.floor(Date.now() / 1000) + 3600,
    email: 'dono@exemplo.test',
    name: 'Dono do canal',
    ...overrides,
  };
}

/** Verificador que devolve um payload fixo (ou lança, quando `erro` é passado). */
export function verificadorDeTeste(
  payload: GoogleTokenPayload = payloadDeTeste(),
  erro?: Error,
): GoogleTokenVerifier {
  return async () => {
    if (erro !== undefined) throw erro;
    return payload;
  };
}

/** Contexto pronto para as rotas: header + verificador injetado. */
export function autenticacaoDeTeste(
  payload: GoogleTokenPayload = payloadDeTeste(),
  token: string = TOKEN_DE_TESTE,
): { authorization: string; verify: GoogleTokenVerifier } {
  return { authorization: `Bearer ${token}`, verify: verificadorDeTeste(payload) };
}

/** Guarda os valores do ambiente que os testes mexem, para restaurar depois. */
export function isolarAmbiente(): () => void {
  const chaves = ['GOOGLE_CLIENT_ID', 'REBECA_ALLOWED_SUBS', 'REBECA_COST_LEDGER'] as const;
  const antes = new Map(chaves.map((chave) => [chave, process.env[chave]]));

  return () => {
    for (const [chave, valor] of antes) {
      if (valor === undefined) delete process.env[chave];
      else process.env[chave] = valor;
    }
  };
}
