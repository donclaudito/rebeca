/**
 * Diagnóstico do adaptador do Google quando o provedor responde **200 sem conteúdo**.
 *
 * Defeito que isto cobre, relatado pelo dono do produto: ele colou a chave do Gemini, clicou em
 * "Testar conexão" e recebeu **"O provedor não aceitou a chamada de teste. resposta sem 'parts'"**.
 * A mensagem não dizia o que fazer — e o motivo real estava na resposta, disponível e ignorado.
 *
 * O Google devolve 200 sem `parts` em casos legítimos: `finishReason: SAFETY` (filtro), `RECITATION`,
 * ou `MAX_TOKENS` quando o modelo consome o orçamento de saída no raciocínio interno. Nenhum desses é
 * defeito nosso, e todos são acionáveis — desde que a tela diga **qual** foi.
 *
 * A rede é substituída: nenhuma chamada real a provedor, nenhuma chave.
 */

import { describe, expect, it, vi } from 'vitest';
import { handleTestProvider } from '../../../server/ai/handler';

const CHAVE = 'chave-de-teste-google-000000';

/** Resposta 200 no formato do Google, com o candidato que o teste precisa montar. */
function respostaGoogle(candidate: Record<string, unknown>, promptFeedback?: Record<string, unknown>) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      candidates: [candidate],
      ...(promptFeedback ? { promptFeedback } : {}),
      usageMetadata: { promptTokenCount: 12, responseTokenCount: 0 },
    }),
  };
}

function stub(body: unknown) {
  vi.stubGlobal('fetch', vi.fn(async () => body));
}

describe('diagnóstico do teste de conexão do Google', () => {
  it('candidato sem conteúdo por corte de tokens diz MAX_TOKENS, e não "resposta sem parts"', async () => {
    stub(respostaGoogle({ finishReason: 'MAX_TOKENS' }));

    const resultado = await handleTestProvider({ provider: 'google', apiKey: CHAVE });

    expect(resultado.ok).toBe(false);
    expect(resultado.message).toMatch(/MAX_TOKENS/);
    // O que saiu de cena: a mensagem que não dizia nada.
    expect(resultado.message).not.toMatch(/resposta sem "parts"/);
  });

  it('bloqueio por segurança nomeia o motivo do candidato', async () => {
    stub(respostaGoogle({ finishReason: 'SAFETY', content: {} }));

    const resultado = await handleTestProvider({ provider: 'google', apiKey: CHAVE });

    expect(resultado.ok).toBe(false);
    expect(resultado.message).toMatch(/SAFETY/);
  });

  it('bloqueio no pedido inteiro usa o blockReason do promptFeedback', async () => {
    stub(respostaGoogle({ finishReason: 'OTHER' }, { blockReason: 'PROHIBITED_CONTENT' }));

    const resultado = await handleTestProvider({ provider: 'google', apiKey: CHAVE });

    expect(resultado.ok).toBe(false);
    expect(resultado.message).toMatch(/PROHIBITED_CONTENT/);
  });

  it('sem motivo informado, a tela diz que o provedor não informou — em vez de inventar', async () => {
    stub(respostaGoogle({}));

    const resultado = await handleTestProvider({ provider: 'google', apiKey: CHAVE });

    expect(resultado.ok).toBe(false);
    expect(resultado.message).toMatch(/não informou o motivo/i);
  });

  it('candidato com conteúdo vazio também é explicado, não engolido', async () => {
    stub(respostaGoogle({ finishReason: 'MAX_TOKENS', content: { parts: [] } }));

    const resultado = await handleTestProvider({ provider: 'google', apiKey: CHAVE });

    expect(resultado.ok).toBe(false);
    expect(resultado.message).toMatch(/vazio/i);
    expect(resultado.message).toMatch(/MAX_TOKENS/);
  });

  it('tempo esgotado diz o limite e o que fazer, em vez de só "tempo esgotado"', async () => {    /*
     * Segundo relato do dono, depois da correção anterior: a tela passou a dizer "tempo esgotado na
     * chamada ao provedor" — melhor que "resposta sem parts", mas ainda sem dizer de quanto tempo se
     * trata nem o que fazer. O limite do teste é lido de `AI_LIMITS.testTimeoutMs` (60 s): modelo que
     * "pensa" pode consumi-lo em raciocínio, e isso é diferente de rede ou chave errada.
     */
    const abortado = new Error('aborted');
    abortado.name = 'AbortError';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw abortado;
      }),
    );

    const resultado = await handleTestProvider({ provider: 'google', apiKey: CHAVE });

    expect(resultado.ok).toBe(false);
    expect(resultado.message).toMatch(/tempo esgotado/i);
    expect(resultado.message).toMatch(/60 s/);
    expect(resultado.message).toMatch(/rede, endereço ou disponibilidade/i);
  });

  it('a GERAÇÃO também explica o tempo esgotado — e que nada foi cobrado', async () => {
    /*
     * O mesmo limite vale no caminho de geração, e foi ali que o dono do produto viu **HTTP 504** no
     * console do navegador. Antes a mensagem era genérica ("O provedor de IA não respondeu como
     * esperado") e não dizia nem o limite nem se houve gasto. Este teste chama o adaptador real da
     * OpenAI com um `fetch` que estoura por tempo.
     */
    const abortado = new Error('aborted');
    abortado.name = 'AbortError';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw abortado;
      }),
    );

    const { PROVIDERS } = await import('../../../server/ai/providers');
    const erro: unknown = await PROVIDERS.openai
      .complete({
        model: 'gpt-6-luna',
        system: 'sistema',
        user: 'usuário',
        maxOutputTokens: 16,
        jsonSchema: null,
        apiKey: 'chave-de-teste-000000',
        baseUrl: 'https://exemplo.invalido/v1/chat/completions',
        signal: new AbortController().signal,
      })
      .catch((capturado: unknown) => capturado);

    const mensagem = String((erro as { message?: string }).message ?? '');
    expect(mensagem).toMatch(/90 s/);
    expect(mensagem).toMatch(/nada foi cobrado/i);
    expect((erro as { status?: number }).status).toBe(504);
  });
});
