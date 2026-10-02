/**
 * Prova adversarial da guarda de identidade (`server/auth/guard.ts`).
 *
 * O que estes testes tentam **refutar**: que alguém sem credencial válida — ou com credencial válida
 * de conta não autorizada — consiga chegar ao handler que gasta dinheiro. O `ADR-014` fixa o critério
 * e cada item dele vira um caso aqui:
 *
 * | Critério do ADR | Caso |
 * |---|---|
 * | token ausente → 401 | "sem header", "esquema errado", "Bearer vazio" |
 * | assinatura/`aud`/`iss`/`exp` inválidos → 401 | um caso por item |
 * | `sub` fora da lista → 403 | "recusa conta fora da lista" |
 * | servidor sem Client ID → não responde | "falha fechada" |
 * | rate limit → 429 | "limite por identidade" |
 *
 * Um caso que não está na lista do ADR, mas que a leitura do código da biblioteca do Google obrigou a
 * incluir: **a mensagem de erro dela não pode vazar o token**. O `google-auth-library` lança, em
 * caminhos reais, `Wrong number of segments in token: <o token inteiro>` — e o token é a credencial.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { authorizeRequest, bearerToken } from '../../../server/auth/guard.js';
import { resetRateLimits, AUTH_RATE_LIMIT } from '../../../server/auth/rate-limit.js';
import { VerificacaoIndisponivelError } from '../../../server/auth/verify.js';
import {
  CLIENT_ID_DE_TESTE,
  SUB_AUTORIZADO,
  SUB_NAO_AUTORIZADO,
  TOKEN_DE_TESTE,
  autenticacaoDeTeste,
  isolarAmbiente,
  payloadDeTeste,
  verificadorDeTeste,
} from './test-support.js';

let restaurarAmbiente: () => void;

beforeEach(() => {
  restaurarAmbiente = isolarAmbiente();
  process.env['GOOGLE_CLIENT_ID'] = CLIENT_ID_DE_TESTE;
  process.env['REBECA_ALLOWED_SUBS'] = SUB_AUTORIZADO;
  resetRateLimits();
});

afterEach(() => {
  restaurarAmbiente();
  resetRateLimits();
});

describe('leitura do header Authorization', () => {
  it('aceita Bearer com qualquer caixa e recusa o resto', () => {
    expect(bearerToken(`Bearer ${TOKEN_DE_TESTE}`)).toBe(TOKEN_DE_TESTE);
    expect(bearerToken(`bearer ${TOKEN_DE_TESTE}`)).toBe(TOKEN_DE_TESTE);
    // RFC 6750 admite mais de um espaço entre o esquema e o valor.
    expect(bearerToken(`Bearer   ${TOKEN_DE_TESTE}`)).toBe(TOKEN_DE_TESTE);
    expect(bearerToken('Basic dXNlcjpzZW5oYQ==')).toBeNull();
    expect(bearerToken('Bearer')).toBeNull();
    expect(bearerToken('Bearer ')).toBeNull();
    expect(bearerToken(undefined)).toBeNull();
    expect(bearerToken(null)).toBeNull();
    // O token não pode vir colado de outra coisa.
    expect(bearerToken(`Bearer ${TOKEN_DE_TESTE} extra`)).toBeNull();
  });
});

describe('recusa sem identificar quem é (401)', () => {
  it('sem header não passa', async () => {
    const resultado = await authorizeRequest({});
    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.status).toBe(401);
    expect(resultado.body.code).toBe('token-ausente');
  });

  it('com esquema errado é o mesmo que sem token', async () => {
    const resultado = await authorizeRequest({ authorization: 'Basic dXNlcjpzZW5oYQ==' });
    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.status).toBe(401);
    expect(resultado.body.code).toBe('token-ausente');
  });

  it('token com assinatura recusada pelo Google não passa', async () => {
    const resultado = await authorizeRequest({
      authorization: `Bearer ${TOKEN_DE_TESTE}`,
      verify: verificadorDeTeste(payloadDeTeste(), new Error('Wrong number of segments in token: ' + TOKEN_DE_TESTE)),
    });
    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.status).toBe(401);
    expect(resultado.body.code).toBe('token-invalido');
  });

  it('token vencido não passa', async () => {
    const vencido = payloadDeTeste({ exp: Math.floor(Date.now() / 1000) - 60 });
    const resultado = await authorizeRequest(autenticacaoDeTeste(vencido));
    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.status).toBe(401);
    expect(resultado.body.detail).toContain('vencido');
  });

  it('token emitido para outro aplicativo (aud) não passa', async () => {
    const outroApp = payloadDeTeste({ aud: 'outro-app.apps.googleusercontent.com' });
    const resultado = await authorizeRequest(autenticacaoDeTeste(outroApp));
    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.status).toBe(401);
    expect(resultado.body.detail).toContain('público');
  });

  it('token de outro emissor (iss) não passa', async () => {
    const outroEmissor = payloadDeTeste({ iss: 'https://accounts.evil.test' });
    const resultado = await authorizeRequest(autenticacaoDeTeste(outroEmissor));
    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.status).toBe(401);
    expect(resultado.body.detail).toContain('emissor');
  });

  it('token sem "sub" não passa — não há identidade para autorizar', async () => {
    const semSub = payloadDeTeste({ sub: undefined });
    const resultado = await authorizeRequest(autenticacaoDeTeste(semSub));
    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.status).toBe(401);
  });

  it('token que nem tem forma de JWT é recusado antes de qualquer chamada', async () => {
    let chamou = false;
    const espiao = async (): Promise<never> => {
      chamou = true;
      throw new Error('não deveria ser chamado');
    };
    const resultado = await authorizeRequest({ authorization: 'Bearer nao-e-um-jwt', verify: espiao });
    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.status).toBe(401);
    // O ponto: nenhuma chamada de rede foi gasta com algo que nem tem forma de token.
    expect(chamou).toBe(false);
  });

  it('a mensagem de erro da biblioteca não devolve o token na resposta', async () => {
    const vazamento = new Error(`Wrong number of segments in token: ${TOKEN_DE_TESTE}`);
    const resultado = await authorizeRequest({
      authorization: `Bearer ${TOKEN_DE_TESTE}`,
      verify: verificadorDeTeste(payloadDeTeste(), vazamento),
    });
    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;

    // O corpo inteiro serializado, como ele sai pela rede.
    const serializado = JSON.stringify(resultado.body);
    expect(serializado).not.toContain(TOKEN_DE_TESTE);
    expect(serializado).not.toContain('Wrong number of segments');
    expect(resultado.body.detail).toBeDefined();
  });

  it('distingue "não deu para verificar" de "a assinatura não confere"', async () => {
    /*
     * A diferença não é cosmética: se a biblioteca de verificação não carregar no deploy (a classe de
     * defeito que já derrubou a IA com HTTP 500 uma vez), dizer "credencial inválida" mandaria o dono
     * procurar defeito na conta do Google — com um login legítimo na mão. O motivo tem de nomear a
     * causa certa.
     */
    const resultado = await authorizeRequest({
      authorization: `Bearer ${TOKEN_DE_TESTE}`,
      verify: verificadorDeTeste(
        payloadDeTeste(),
        new VerificacaoIndisponivelError('biblioteca ausente no bundle'),
      ),
    });

    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.status).toBe(401);
    expect(resultado.body.detail).toContain('indisponível');
  });
});

describe('recusa quem entrou mas não tem acesso (403)', () => {
  it('conta fora da lista recebe 403, com o próprio sub e sem a lista', async () => {
    const estranho = payloadDeTeste({ sub: SUB_NAO_AUTORIZADO, email: 'estranho@exemplo.test' });
    const resultado = await authorizeRequest(autenticacaoDeTeste(estranho));
    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;

    expect(resultado.status).toBe(403);
    expect(resultado.body.code).toBe('conta-nao-autorizada');
    // O sub de quem perguntou aparece: é o caminho para destravar o acesso.
    expect(resultado.body.message).toContain(SUB_NAO_AUTORIZADO);
    expect(resultado.body.message).toContain('REBECA_ALLOWED_SUBS');
    // A lista de quem **está** autorizado não pode aparecer para quem não está.
    expect(resultado.body.message).not.toContain(SUB_AUTORIZADO);
  });

  it('avisa quando a lista tem e-mail no lugar do sub', async () => {
    // O erro provável de quem leu o runbook pela metade: a lista "parece" preenchida e todo mundo
    // recebe 403 sem pista. O aviso diz a natureza do erro **sem ecoar a entrada da lista** — o
    // e-mail que aparece na resposta é o de quem perguntou (a própria identidade dele), nunca o da
    // lista. Por isso os dois valores aqui são diferentes: é o que torna a asserção capaz de falhar.
    const emailDaLista = 'outro-dono@exemplo.test';
    process.env['REBECA_ALLOWED_SUBS'] = emailDaLista;
    const resultado = await authorizeRequest(autenticacaoDeTeste());
    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.status).toBe(403);
    expect(resultado.body.message).toContain('não parecem número de sub');
    expect(resultado.body.message).not.toContain(emailDaLista);
    // E o que **deve** aparecer: o sub de quem perguntou, que é o caminho para destravar.
    expect(resultado.body.message).toContain(SUB_AUTORIZADO);
  });

  it('sem lista configurada, ninguém entra — e a mensagem explica por quê', async () => {
    delete process.env['REBECA_ALLOWED_SUBS'];
    const resultado = await authorizeRequest(autenticacaoDeTeste());
    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.status).toBe(403);
    expect(resultado.body.message).toContain('REBECA_ALLOWED_SUBS');
  });
});

describe('falha fechada quando a autenticação não está configurada', () => {
  it('sem GOOGLE_CLIENT_ID nenhuma rota responde — nem com token na mão', async () => {
    delete process.env['GOOGLE_CLIENT_ID'];
    const resultado = await authorizeRequest(autenticacaoDeTeste());
    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.status).toBe(503);
    expect(resultado.body.code).toBe('autenticacao-nao-configurada');
    // A mensagem nomeia a variável: erro de configuração precisa ser corrigível sem adivinhação.
    expect(resultado.body.message).toContain('GOOGLE_CLIENT_ID');
  });
});

describe('identidade autorizada', () => {
  it('devolve o sub e os rótulos de exibição, e ignora e-mail para autorizar', async () => {
    const resultado = await authorizeRequest(autenticacaoDeTeste());
    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;

    expect(resultado.identity.sub).toBe(SUB_AUTORIZADO);
    expect(resultado.identity.email).toBe('dono@exemplo.test');

    /*
     * A prova de que o e-mail **não** autoriza: o mesmo `sub` autorizado continua entrando com um
     * e-mail diferente (a documentação do Google avisa que uma conta pode trocar de endereço), e um
     * e-mail que está na lista não faz um `sub` desconhecido entrar.
     */
    const outroEmail = await authorizeRequest(
      autenticacaoDeTeste(payloadDeTeste({ email: 'novo-endereco@exemplo.test' })),
    );
    expect(outroEmail.ok).toBe(true);

    process.env['REBECA_ALLOWED_SUBS'] = 'dono@exemplo.test';
    const porEmail = await authorizeRequest(autenticacaoDeTeste());
    expect(porEmail.ok).toBe(false);
  });

  it('a lista aceita vírgula, ponto e vírgula e espaço', async () => {
    process.env['REBECA_ALLOWED_SUBS'] = ` ${SUB_NAO_AUTORIZADO} , ${SUB_AUTORIZADO} `;
    const resultado = await authorizeRequest(autenticacaoDeTeste());
    expect(resultado.ok).toBe(true);
  });

  it('tolera caractere INVISÍVEL no sub — o sintoma que travou o dono', async () => {
    /*
     * O caso real: a tela recusava a conta mostrando o `sub` que estava na lista, e o servidor imprimia
     * a lista com aquele mesmo texto. Strings iguais não falham em `Set.has` — logo o identificador que
     * chega do Google carrega algo que não se vê (espaço de largura zero, espaço não separável, marca
     * de ordem de bytes). Colar um `sub` de um log, de um PDF ou de uma captura de tela é por onde esse
     * lixo entra.
     *
     * O que não pode acontecer, e o teste ao lado garante: **lixo invisível não vira passe livre** —
     * um `sub` desconhecido continua recusado.
     */
    process.env['REBECA_ALLOWED_SUBS'] = SUB_AUTORIZADO;

    for (const invisivel of ['\u200b', '\ufeff', '\u00a0', '\u200f']) {
      const sujo = `${SUB_AUTORIZADO}${invisivel}`;
      const resultado = await authorizeRequest(autenticacaoDeTeste(payloadDeTeste({ sub: sujo })));
      expect(resultado.ok, `o sub com ${JSON.stringify(invisivel)} deveria ser reconhecido`).toBe(true);
    }

    // E o invisível no MEIO também: é o que acontece ao copiar de um texto formatado.
    const noMeio = `${SUB_AUTORIZADO.slice(0, 10)}\u200b${SUB_AUTORIZADO.slice(10)}`;
    expect((await authorizeRequest(autenticacaoDeTeste(payloadDeTeste({ sub: noMeio })))).ok).toBe(true);

    // O limite continua de pé: nada de aceitar quem não está na lista.
    expect((await authorizeRequest(autenticacaoDeTeste(payloadDeTeste({ sub: SUB_NAO_AUTORIZADO })))).ok).toBe(
      false,
    );
  });
});

describe('limite de uso por identidade', () => {
  it('a chamada que passa do limite recebe 429 e não chega ao handler', async () => {
    const autorizado = autenticacaoDeTeste();
    for (let i = 0; i < AUTH_RATE_LIMIT.limit; i += 1) {
      const resultado = await authorizeRequest(autorizado);
      expect(resultado.ok).toBe(true);
    }

    const excedente = await authorizeRequest(autorizado);
    expect(excedente.ok).toBe(false);
    if (excedente.ok) return;
    expect(excedente.status).toBe(429);
    expect(excedente.body.code).toBe('limite-de-uso');
    expect(excedente.body.retryable).toBe(true);
  });

  it('o limite é por identidade: a conta A não consome a cota da conta B', async () => {
    process.env['REBECA_ALLOWED_SUBS'] = `${SUB_AUTORIZADO},${SUB_NAO_AUTORIZADO}`;

    for (let i = 0; i < AUTH_RATE_LIMIT.limit; i += 1) {
      await authorizeRequest(autenticacaoDeTeste());
    }
    expect((await authorizeRequest(autenticacaoDeTeste())).ok).toBe(false);

    const outraConta = await authorizeRequest(autenticacaoDeTeste(payloadDeTeste({ sub: SUB_NAO_AUTORIZADO })));
    expect(outraConta.ok).toBe(true);
  });

  it('quem não está na lista não consome cota nem é contado', async () => {
    // A ordem importa: a lista de acesso é conferida **antes** do contador, senão quem não pode usar
    // nada gastaria memória do processo à toa.
    for (let i = 0; i < AUTH_RATE_LIMIT.limit + 5; i += 1) {
      const resultado = await authorizeRequest(
        autenticacaoDeTeste(payloadDeTeste({ sub: SUB_NAO_AUTORIZADO })),
      );
      expect(resultado.ok).toBe(false);
      if (!resultado.ok) expect(resultado.status).toBe(403);
    }

    // A conta autorizada continua com a cota inteira.
    expect((await authorizeRequest(autenticacaoDeTeste())).ok).toBe(true);
  });
});
