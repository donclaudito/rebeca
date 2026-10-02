/**
 * Regressão do defeito de encanamento que o **dono encontrou usando o app** (2026-10-02): editar
 * `REBECA_ALLOWED_SUBS` no `.env` não tinha efeito nenhum — o app continuava recusando a conta dele.
 *
 * O que foi medido, e é o que este arquivo protege:
 *
 * 1. O Vite **não** injeta `.env` em `process.env` (a implementação instalada só escreve três chaves:
 *    `VITE_USER_NODE_ENV`, `BROWSER`, `BROWSER_ARGS`).
 * 2. Copiar os valores para o processo na avaliação do `vite.config.ts` **não basta**: o Vite não
 *    reavalia a configuração quando o `.env` muda. Medido com valor sentinela: sete segundos depois da
 *    edição, `GET /api/auth/config` ainda devolvia o valor antigo. O sintoma na tela era **"conta
 *    ainda não autorizada"** com o `sub` certo na mão — defeito de encanamento disfarçado de defeito
 *    de acesso, que manda a pessoa procurar no lugar errado.
 * 3. A correção: ler o **arquivo** na hora do uso (`server/dev-env.ts`), com cache por `mtime`.
 * 4. E o limite que não pode ser ultrapassado: em **teste** e em **produção** o arquivo é ignorado. Um
 *    `.env` de máquina de desenvolvimento não pode mudar o resultado da suíte — neste projeto isso já
 *    quase fez um teste topar com uma chave paga de verdade.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  interpretarEnv,
  valorDoEnvDeDesenvolvimento,
  CHAVES_DO_SERVIDOR_NO_ENV,
} from '../../server/dev-env.js';
import { allowedSubs } from '../../server/auth/access.js';
import { googleClientId } from '../../server/auth/config.js';

describe('interpretação do arquivo .env', () => {
  it('lê chave=valor, ignora comentário e linha vazia', () => {
    const valores = interpretarEnv(
      ['# comentário', '', 'GOOGLE_CLIENT_ID=abc.apps.googleusercontent.com', '   ', 'OUTRA=1'].join('\n'),
    );
    expect(valores['GOOGLE_CLIENT_ID']).toBe('abc.apps.googleusercontent.com');
    expect(valores['OUTRA']).toBe('1');
    expect(Object.keys(valores)).toHaveLength(2);
  });

  it('aceita `export`, aspas e `#` dentro de aspas, e preserva `=` no valor', () => {
    const valores = interpretarEnv(
      [
        'export REBECA_ALLOWED_SUBS=111,222',
        'COM_ASPAS="valor # com cerquilha"',
        'SIMPLES=\'outro valor\'',
        'COM_IGUAL=a=b=c',
        'COMENTADA=valor # isto é comentário',
      ].join('\n'),
    );

    expect(valores['REBECA_ALLOWED_SUBS']).toBe('111,222');
    expect(valores['COM_ASPAS']).toBe('valor # com cerquilha');
    expect(valores['SIMPLES']).toBe('outro valor');
    expect(valores['COM_IGUAL']).toBe('a=b=c');
    expect(valores['COMENTADA']).toBe('valor');
  });

  it('ignora linha sem `=` e nome de chave inválido em vez de inventar', () => {
    const valores = interpretarEnv(['sem igual', '2INVALIDA=x', '=vazio', 'OK=x'].join('\n'));
    expect(valores).toEqual({ OK: 'x' });
  });
});

describe('o arquivo do .env NÃO influencia teste nem produção', () => {
  /*
   * O `cwd` da suíte é a raiz do repositório, onde o `.env` **existe** e tem os `sub` reais do dono.
   * Se a leitura do arquivo vazasse para o teste, a suíte passaria a depender da máquina de quem roda
   * — e um caso que mede "sem lista configurada, ninguém entra" deixaria de medir isso.
   */
  const antes = { GOOGLE_CLIENT_ID: process.env['GOOGLE_CLIENT_ID'], REBECA_ALLOWED_SUBS: process.env['REBECA_ALLOWED_SUBS'] };

  beforeEach(() => {
    delete process.env['GOOGLE_CLIENT_ID'];
    delete process.env['REBECA_ALLOWED_SUBS'];
  });

  afterEach(() => {
    if (antes.GOOGLE_CLIENT_ID === undefined) delete process.env['GOOGLE_CLIENT_ID'];
    else process.env['GOOGLE_CLIENT_ID'] = antes.GOOGLE_CLIENT_ID;
    if (antes.REBECA_ALLOWED_SUBS === undefined) delete process.env['REBECA_ALLOWED_SUBS'];
    else process.env['REBECA_ALLOWED_SUBS'] = antes.REBECA_ALLOWED_SUBS;
  });

  it('em ambiente de teste o arquivo é ignorado (a suíte mede o que ela mesma define)', () => {
    expect(process.env['VITEST'], 'a suíte precisa estar marcada como teste para este caso valer').toBeDefined();

    expect(valorDoEnvDeDesenvolvimento('GOOGLE_CLIENT_ID')).toBeNull();
    expect(valorDoEnvDeDesenvolvimento('REBECA_ALLOWED_SUBS')).toBeNull();

    // E o efeito prático: sem variável no processo, a lista é vazia — mesmo com o `.env` cheio.
    expect(googleClientId()).toBeNull();
    expect(allowedSubs().size).toBe(0);
  });

  it('a lista continua vindo do ambiente do processo quando ele define', () => {
    process.env['REBECA_ALLOWED_SUBS'] = '111111111111111111111, 222222222222222222222';
    expect([...allowedSubs()]).toEqual(['111111111111111111111', '222222222222222222222']);
  });

  it('administra exatamente duas chaves — a lista é explícita, não "tudo que está no .env"', () => {
    // Copiar toda variável do `.env` para o processo é como um teste topa com credencial paga.
    expect([...CHAVES_DO_SERVIDOR_NO_ENV]).toEqual(['GOOGLE_CLIENT_ID', 'REBECA_ALLOWED_SUBS']);
  });
});
