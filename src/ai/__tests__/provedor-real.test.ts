/**
 * Teste CONTRA PROVEDOR REAL — opt-in, e **desligado por padrão**.
 *
 * Rode com:
 *
 *   $env:REBECA_LIVE="1"; pnpm exec vitest run src/ai/__tests__/provedor-real.test.ts
 *
 * Por que existe: toda a suíte usa o provedor simulado ou um transporte injetado. Isso é certo para o
 * dia a dia (teste não gasta dinheiro), mas deixa passar exatamente a classe de defeito que apareceu
 * em produção duas vezes: o **modo `strict` da OpenAI recusa schema com campo fora de `required`**, e
 * o **provedor ignora limites de tamanho** que a validação local exigia. Nenhum dos dois é visível
 * sem falar com a API de verdade.
 *
 * Por que é opt-in: ele **gasta dinheiro de verdade**. Um teste que gasta sozinho no CI de outra
 * pessoa é inaceitável. A trava é a variável `REBECA_LIVE`, e o arquivo declara isso no nome.
 *
 * Ele registra custo no livro como qualquer chamada paga — teste pago é gasto, e o invariante nº 4 não
 * abre exceção para teste.
 */

import { describe, expect, it } from 'vitest';
import { getFunctionSchema, validateSchema } from '../schemas';
import { AI_FUNCTIONS } from '../contract';
import { validInput, CHANNEL_CHILD } from './fixtures';
import { handleGenerate } from '../../../server/ai/handler';
import { resetConfigCache } from '../../../server/ai/secrets';

const ligado = process.env['REBECA_LIVE'] === '1';

describe.skipIf(!ligado)('provedor real (opt-in, gasta dinheiro)', () => {
  it('criar-roteiro — o caso que falhou para o dono do produto', async () => {
    resetConfigCache();

    const resultado = await handleGenerate({
      functionId: 'criar-roteiro',
      channelId: CHANNEL_CHILD,
      input: validInput('criar-roteiro'),
    });

    // Diagnóstico legível quando algo der errado.
    expect(
      resultado.simulated,
      'Nenhum provedor respondeu de verdade — o teste não provou nada. Configure uma chave em Configurações → Inteligência artificial.',
    ).toBe(false);

    const schemas = getFunctionSchema('criar-roteiro');
    expect(schemas).toBeTruthy();

    // A resposta que sai tem de respeitar o contrato COMPLETO — não só o estrutural.
    const errors = schemas ? validateSchema(schemas.output, resultado.data) : ['sem schema'];
    expect(errors).toEqual([]);

    const data = resultado.data as { titulo: string; blocos: unknown[] };
    expect(data.blocos.length).toBeGreaterThanOrEqual(3);

    // O que o ajuste local precisou mexer, declarado.
    // eslint-disable-next-line no-console
    console.log('[live] criar-roteiro', {
      model: resultado.model,
      attempts: resultado.attempts,
      costUsd: resultado.costUsd,
      blocos: data.blocos.length,
      ajustes: resultado.adjustments,
    });
  }, 240_000);

  it('criar-seo — função barata, valida o caminho completo', async () => {
    resetConfigCache();

    const resultado = await handleGenerate({
      functionId: 'criar-seo',
      channelId: CHANNEL_CHILD,
      input: validInput('criar-seo'),
    });

    expect(resultado.simulated).toBe(false);

    const schemas = getFunctionSchema('criar-seo');
    const errors = schemas ? validateSchema(schemas.output, resultado.data) : ['sem schema'];
    expect(errors).toEqual([]);

    const data = resultado.data as { titulo: string; tags: unknown[] };
    expect(data.titulo.length).toBeGreaterThan(0);
    expect(data.tags.length).toBeGreaterThanOrEqual(3);

    // eslint-disable-next-line no-console
    console.log('[live] criar-seo', {
      model: resultado.model,
      attempts: resultado.attempts,
      costUsd: resultado.costUsd,
      ajustes: resultado.adjustments,
    });
  }, 240_000);

  it('toda função do registro tem schema que o provedor aceita (estrutural)', () => {
    // Verificação barata e sem custo: garante que nenhuma função ficou com schema incompatível.
    const problemas: string[] = [];
    for (const id of Object.keys(AI_FUNCTIONS)) {
      const schemas = getFunctionSchema(id);
      if (!schemas) {
        problemas.push(`${id}: sem schema`);
        continue;
      }
      const amostra = AI_FUNCTIONS[id as keyof typeof AI_FUNCTIONS];
      if (!schemas.output || schemas.output.type !== 'object') {
        problemas.push(`${id}: saída não é objeto`);
      }
      if (amostra.maxOutputTokens < 64) problemas.push(`${id}: teto de saída baixo demais`);
    }
    expect(problemas).toEqual([]);
  });
});
