/**
 * Prova adversarial do **vazamento de credencial pelo caminho real do provedor**.
 *
 * Contexto do achado: `handler.test.ts` tem um teste chamado "não vaza chave nem corpo cru do
 * provedor na mensagem de erro" que passa — mas ele planta a chave jogando um `Error` **comum** de
 * dentro do `transport` injetado. Esse caminho cai no ramo de "erro inesperado" de `handleGenerate`,
 * que aplica `redact()`. Ou seja: o teste prova que **um** dos dois caminhos está limpo.
 *
 * O caminho que roda de verdade quando existe chave configurada é outro:
 *
 *   handleGenerate → callProvider → PROVIDERS[openai].complete → postJson
 *     → resposta 401 → safeProviderMessage(body)   [providers.ts:83]
 *     → providerError(...)   → **AiError** com o texto do provedor em `detail`
 *     → catch de handleGenerate: `if (error instanceof AiError) throw error;`   ← passa direto
 *     → http.ts:76 `error.toBody()`                → **vai para o navegador**
 *
 * `AiError` **não** passa por `redact()`. E o próprio comentário de `providers.ts` reconhece o
 * risco: "A resposta de erro de uma API costuma repetir parte da requisição — inclusive cabeçalhos,
 * em alguns casos." Um provedor que ecoe o `Authorization` devolve a chave ao cliente.
 *
 * Os dois testes abaixo são o par que expõe a assimetria: a mesma chave entra por dois pontos, e só
 * um deles está protegido. O segundo injeta o `AiError` direto no transporte, para exercitar o
 * mesmo tipo de erro de `providerError` sem depender de rede.
 */

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleGenerate } from '../../../server/ai/handler';
import { resetMemoryLedger } from '../../../server/ai/ledger';
import { AiError } from '../contract';
import { CHANNEL_ADULT, validInput } from './fixtures';

/** Valor inventado, no formato de chave real, só para rastrear vazamento na asserção. */
const CHAVE = 'sk-chaveDeTesteQueNaoPodeVazar0123456789abcdef';

const originalEnv = { ...process.env };
let tempDir: string;

const PROVEDORES = [
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'DEEPSEEK_API_KEY',
  'GEMINI_API_KEY',
  'OPENROUTER_API_KEY',
  'REBECA_PROVIDER_ORDER',
  'REBECA_MODEL_RAPIDO',
  'REBECA_COST_LEDGER',
];

/** Pedido válido e barato: `criar-seo` é nível `rapido` e não é função de canal infantil. */
function pedido() {
  return {
    functionId: 'criar-seo',
    channelId: CHANNEL_ADULT,
    input: validInput('criar-seo'),
  };
}

/** O que `http.ts` de fato serializa para o navegador (`AiError.toBody()`). */
function corpoEnviadoAoNavegador(error: unknown): string {
  if (error && typeof error === 'object' && typeof (error as { toBody?: unknown }).toBody === 'function') {
    return JSON.stringify((error as { toBody: () => unknown }).toBody());
  }
  return JSON.stringify({
    message: error instanceof Error ? error.message : String(error),
    detail: (error as { detail?: string } | null)?.detail,
  });
}

type Opcoes = Parameters<typeof handleGenerate>[1];

async function capturarErro(options?: Opcoes): Promise<string> {
  try {
    await handleGenerate(pedido(), options);
  } catch (error) {
    return corpoEnviadoAoNavegador(error);
  }
  throw new Error('esperava falha do provedor; a chamada resolveu sem erro');
}

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'rebeca-vazamento-'));
  for (const nome of PROVEDORES) delete process.env[nome];
  process.env['OPENAI_API_KEY'] = CHAVE;
  // O livro de custos nunca é o real em teste (invariante nº 4).
  process.env['REBECA_COST_LEDGER'] = join(tempDir, 'custos.csv');
  resetMemoryLedger();
});

afterEach(() => {
  process.env = { ...originalEnv };
  vi.unstubAllGlobals();
  rmSync(tempDir, { recursive: true, force: true });
});

describe('vazamento de credencial do provedor', () => {
  it('caminho REAL (adaptador OpenAI): resposta 401 que ecoa o Authorization não chega ao navegador', async () => {
    // O provedor devolve o cabeçalho dentro da própria mensagem de erro — o caso que o comentário
    // de `providers.ts` declara possível.
    vi.stubGlobal('fetch', async () => ({
      ok: false,
      status: 401,
      json: async () => ({
        error: {
          type: 'invalid_api_key',
          message: `Incorrect API key provided: Authorization: Bearer ${CHAVE}`,
        },
      }),
    }));

    const texto = await capturarErro();

    // Não vacuidade: o erro do provedor **de fato** chegou ao limite e trouxe o status. Se este
    // `expect` falhar, o caminho não foi exercitado e a asserção seguinte não prova nada.
    expect(texto).toMatch(/401/);

    // A garantia: a credencial não atravessa para a resposta HTTP.
    expect(texto).not.toContain(CHAVE);
  });

  it('caminho do AiError (o tipo que `providerError` produz): mesma garantia', async () => {
    const texto = await capturarErro({
      transport: async () => {
        throw new AiError(
          {
            code: 'provedor',
            message:
              'O provedor de IA não respondeu como esperado. Nada foi gerado e nada foi publicado.',
            detail: `HTTP 401 — invalid_api_key: Incorrect API key provided: Authorization: Bearer ${CHAVE}`,
            retryable: true,
          },
          502,
        );
      },
    });

    expect(texto).toMatch(/401/);
    expect(texto).not.toContain(CHAVE);
  });
});
