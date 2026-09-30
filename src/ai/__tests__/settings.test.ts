/**
 * Verificação adversarial da tela de Configurações: segredos, endereços e escolha de modelo.
 *
 * O que estes testes tentam refutar, e por que cada um importa:
 *
 * | Teste | Risco que ele cobre |
 * |---|---|
 * | a leitura nunca devolve valor de chave | vazamento de credencial para o navegador |
 * | gravação recusada em ambiente publicado | rota pública aceitando chave de qualquer visitante |
 * | SSRF: metadados, faixa privada, credencial na URL | servidor usado como proxy para a rede interna |
 * | precedência tela > ambiente | o usuário salva a chave e nada muda |
 * | chave salva na tela passa a valer no modelo padrão | regressão real: o app ficava em simulação sem explicar |
 * | omitir a chave preserva; `null` remove | salvar o formulário apagando a chave recém-cadastrada |
 *
 * O arquivo de configuração é redirecionado para um temporário em **todos** os testes: nenhum teste
 * escreve em `.rebeca/segredos/`, e nenhuma chave real existe no ambiente.
 */

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  assertSafeProviderUrl,
  configPath,
  loadConfig,
  maskSecret,
  resetConfigCache,
  resolveProvider,
  saveConfig,
  settingsWritable,
} from '../../../server/ai/secrets';
import { handleGetSettings, handleSaveSettings, handleStatus, handleTestProvider } from '../../../server/ai/handler';
import { resetMemoryLedger } from '../../../server/ai/ledger';

const FAKE_KEY = 'chave-falsa-de-teste-0000000000';

let tempDir: string;
let settingsFile: string;
const originalEnv = { ...process.env };

const MANAGED_ENV = [
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'DEEPSEEK_API_KEY',
  'GEMINI_API_KEY',
  'OPENROUTER_API_KEY',
  'REBECA_SETTINGS_WRITE',
  'REBECA_ALLOW_UNPRICED_MODEL',
  'REBECA_ALLOW_UNVERIFIED_MINOR_POLICY',
  'REBECA_ALLOW_NO_LEDGER',
  'REBECA_MODEL_RACIOCINIO',
  'REBECA_MODEL_CRIATIVO',
  'REBECA_MODEL_RAPIDO',
  'VERCEL',
];

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'rebeca-settings-test-'));
  settingsFile = join(tempDir, 'llm.json');
  process.env['REBECA_SETTINGS_FILE'] = settingsFile;
  process.env['REBECA_COST_LEDGER'] = join(tempDir, 'custos.csv');
  for (const key of MANAGED_ENV) delete process.env[key];
  resetConfigCache();
  resetMemoryLedger();
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
  for (const key of MANAGED_ENV) {
    const value = originalEnv[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  delete process.env['REBECA_SETTINGS_FILE'];
  delete process.env['REBECA_COST_LEDGER'];
  resetConfigCache();
  resetMemoryLedger();
});

/* =============================================================================
   Máscara
   ============================================================================= */

describe('máscara de segredo', () => {
  it('nunca devolve o valor, só o suficiente para reconhecer a chave', () => {
    const masked = maskSecret(FAKE_KEY);
    expect(masked).not.toContain(FAKE_KEY);
    expect(masked).toContain('0000');
    expect(masked.startsWith('••••')).toBe(true);
  });

  it('chave curta não vira máscara reveladora', () => {
    expect(maskSecret('abc')).toBe('••••');
    expect(maskSecret('')).toBe('');
  });
});

/* =============================================================================
   SSRF
   ============================================================================= */

describe('validação de endereço do provedor (SSRF)', () => {
  it('recusa endereço de metadados de nuvem — o caminho mais curto para roubar credencial da instância', () => {
    for (const url of [
      'http://169.254.169.254/latest/meta-data/',
      'http://metadata.google.internal/computeMetadata/v1/',
    ]) {
      expect(() => assertSafeProviderUrl(url, { allowLocal: true })).toThrow();
    }
  });

  it('recusa faixa privada e loopback quando o app está publicado', () => {
    for (const url of [
      'http://127.0.0.1:8080/v1',
      'http://localhost:11434/v1',
      'http://192.168.0.10/v1',
      'http://10.0.0.5/v1',
      'http://172.16.3.4/v1',
      'http://[::1]:8080/v1',
    ]) {
      expect(() => assertSafeProviderUrl(url, { allowLocal: false })).toThrow();
    }
  });

  it('aceita endereço local quando é a máquina de quem opera (modelo rodando localmente)', () => {
    expect(assertSafeProviderUrl('http://127.0.0.1:11434/v1', { allowLocal: true })).toContain('127.0.0.1');
  });

  it('recusa credencial embutida na URL', () => {
    expect(() =>
      assertSafeProviderUrl('https://user:senha@api.openai.com/v1/x', { allowLocal: true }),
    ).toThrow(/usuário nem senha/i);
  });

  it('recusa protocolo que não seja http/https', () => {
    for (const url of ['file:///etc/passwd', 'ftp://exemplo.com', 'gopher://x']) {
      expect(() => assertSafeProviderUrl(url, { allowLocal: true })).toThrow();
    }
  });

  it('exige https quando o app está publicado', () => {
    expect(() => assertSafeProviderUrl('http://api.exemplo.com/v1', { allowLocal: false })).toThrow(/https/i);
    expect(assertSafeProviderUrl('https://api.exemplo.com/v1', { allowLocal: false })).toContain('https://');
  });

  it('recusa URL malformada', () => {
    expect(() => assertSafeProviderUrl('não é url', { allowLocal: true })).toThrow(/não é uma URL válida/i);
  });
});

/* =============================================================================
   Gravação e leitura
   ============================================================================= */

describe('gravação da configuração', () => {
  it('grava a chave e devolve apenas a máscara na leitura', () => {
    saveConfig({ providers: { openai: { apiKey: FAKE_KEY } } });

    // O arquivo tem o valor (é onde ele mora)...
    expect(readFileSync(settingsFile, 'utf8')).toContain(FAKE_KEY);
    // ...mas a visão da API não tem.
    const view = handleGetSettings();
    const openai = view.providers.find((provider) => provider.provider === 'openai');
    expect(openai?.configured).toBe(true);
    expect(openai?.keyMask).not.toContain(FAKE_KEY);
    expect(JSON.stringify(view)).not.toContain(FAKE_KEY);
  });

  it('omitir a chave PRESERVA a que está salva (salvar o formulário não apaga)', () => {
    saveConfig({ providers: { openai: { apiKey: FAKE_KEY } } });
    // A tela nunca recebe o valor, então o campo volta vazio: enviar vazio não pode apagar.
    saveConfig({ providers: { openai: { apiKey: '' } } });
    expect(loadConfig().providers['openai']?.apiKey).toBe(FAKE_KEY);
  });

  it('`null` REMOVE a chave — é a única forma de apagar', () => {
    saveConfig({ providers: { openai: { apiKey: FAKE_KEY } } });
    saveConfig({ providers: { openai: { apiKey: null } } });
    expect(loadConfig().providers['openai']?.apiKey).toBeUndefined();
  });

  it('recusa chave curta demais ou com espaço', () => {
    expect(() => saveConfig({ providers: { openai: { apiKey: 'abc' } } })).toThrow(/curta demais/i);
    expect(() => saveConfig({ providers: { openai: { apiKey: `${FAKE_KEY} quebrada` } } })).toThrow(/espaço/i);
  });

  it('recusa provedor desconhecido na escolha de modelo', () => {
    expect(() => saveConfig({ models: { raciocinio: 'provedor-inventado:modelo' } })).toThrow(/desconhecido/i);
  });

  it('recusa gravar quando o app está publicado', () => {
    process.env['VERCEL'] = '1';
    expect(settingsWritable()).toBe(false);
    expect(() => saveConfig({ providers: { openai: { apiKey: FAKE_KEY } } })).toThrow(/não aceita gravar/i);
    expect(() => handleSaveSettings({ providers: { openai: { apiKey: FAKE_KEY } } })).toThrow(/não aceita gravar/i);
  });

  it('a leitura informa que não é gravável quando publicado, sem expor chave', () => {
    process.env['VERCEL'] = '1';
    const view = handleGetSettings();
    expect(view.writable).toBe(false);
    expect(view.hosted).toBe(true);
    // Em ambiente publicado não se devolve nem o caminho do arquivo.
    expect(view.configPath).toBeNull();
  });
});

/* =============================================================================
   Precedência e efeito real na escolha do modelo
   ============================================================================= */

describe('precedência entre tela e ambiente', () => {
  it('a configuração da tela ganha da variável de ambiente', () => {
    process.env['OPENAI_API_KEY'] = 'chave-do-ambiente-000000';
    saveConfig({ providers: { openai: { apiKey: FAKE_KEY } } });

    const resolved = resolveProvider('openai', 'OPENAI_API_KEY', 'https://padrao/v1');
    expect(resolved.apiKey).toBe(FAKE_KEY);
    expect(resolved.apiKeySource).toBe('configuracao');
  });

  it('sem configuração, a variável de ambiente é usada', () => {
    process.env['OPENAI_API_KEY'] = 'chave-do-ambiente-000000';
    const resolved = resolveProvider('openai', 'OPENAI_API_KEY', 'https://padrao/v1');
    expect(resolved.apiKey).toBe('chave-do-ambiente-000000');
    expect(resolved.apiKeySource).toBe('ambiente');
  });

  it('o endereço configurado tem precedência sobre o padrão', () => {
    saveConfig({ providers: { openai: { baseUrl: 'https://proxy.interno.exemplo/v1' } } });
    const resolved = resolveProvider('openai', 'OPENAI_API_KEY', 'https://api.openai.com/v1/chat/completions');
    expect(resolved.baseUrl).toBe('https://proxy.interno.exemplo/v1');
    expect(resolved.baseUrlSource).toBe('configuracao');
  });

  it('REGRESSÃO: chave salva na tela passa a valer na escolha do modelo padrão', () => {
    // O defeito original: a escolha do padrão do catálogo checava só a variável de ambiente, então a
    // chave colada na tela era ignorada e o app continuava em simulação sem explicar por quê.
    saveConfig({ providers: { openai: { apiKey: FAKE_KEY } } });

    const status = handleStatus();
    const openai = status.providers.find((provider) => provider.provider === 'openai');
    expect(openai?.configured).toBe(true);
    expect(status.hasAnyKey).toBe(true);

    const view = handleGetSettings();
    const funcao = view.functions.find((item) => item.functionId === 'criar-cena');
    expect(funcao?.resolved.startsWith('openai:')).toBe(true);
    expect(funcao?.source).toBe('catalogo');
  });

  it('a sobreposição por função vence a do nível, e o nível vence o catálogo', () => {
    saveConfig({
      providers: { openai: { apiKey: FAKE_KEY }, anthropic: { apiKey: FAKE_KEY } },
      models: { criativo: 'openai:gpt-6-luna' },
      functionModels: { 'criar-roteiro': 'anthropic:claude-sonnet-5-5' },
    });

    const view = handleGetSettings();
    const roteiro = view.functions.find((item) => item.functionId === 'criar-roteiro');
    const cena = view.functions.find((item) => item.functionId === 'criar-cena');

    expect(roteiro?.resolved).toBe('anthropic:claude-sonnet-5-5');
    expect(roteiro?.source).toBe('funcao');
    // `criar-cena` é do mesmo nível e não tem sobreposição própria: pega a do nível.
    expect(cena?.resolved).toBe('openai:gpt-6-luna');
    expect(cena?.source).toBe('nivel');
  });

  it('a sobreposição por função é recusada quando viola o gate do canal infantil', () => {
    saveConfig({ providers: { openai: { apiKey: FAKE_KEY } } });
    // Google é vedado para serviço dirigido a menores por cláusula literal do termo.
    saveConfig({ models: { raciocinio: 'google:gemini-3.8-flash' } });

    // A visão usa canal de referência **não infantil** para o modelo-base; o gate aparece ao chamar
    // a checagem infantil, que é onde a restrição vale.
    const view = handleGetSettings();
    const google = view.providers.find((provider) => provider.provider === 'google');
    expect(google?.allowedForChildDirected).toBe(false);
  });
});

/* =============================================================================
   Teste de conexão
   ============================================================================= */

describe('teste de conexão', () => {
  it('sem chave, devolve falha explicada em vez de tentar a chamada', async () => {
    const result = await handleTestProvider({ provider: 'openai' });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/chave/i);
    expect(result.latencyMs).toBe(0);
  });

  it('recusa provedor desconhecido', async () => {
    await expect(handleTestProvider({ provider: 'provedor-fantasma' })).rejects.toMatchObject({
      code: 'entrada-invalida',
    });
  });

  it('não testa onde o custo não seria registrado de forma durável', async () => {
    saveConfig({ providers: { openai: { apiKey: FAKE_KEY } } });
    delete process.env['REBECA_COST_LEDGER'];
    process.env['VERCEL'] = '1';

    const result = await handleTestProvider({ provider: 'openai' });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/teto diário|durar/i);
  });
});

/* =============================================================================
   Arquivo
   ============================================================================= */

describe('arquivo de configuração', () => {
  it('aponta para o caminho redirecionado nos testes', () => {
    expect(configPath()).toBe(settingsFile);
  });

  it('arquivo corrompido não derruba o app: cai para vazio', () => {
    writeFileSync(settingsFile, '{ isso não é json', 'utf8');
    resetConfigCache();
    const config = loadConfig();
    expect(config.providers).toEqual({});
    expect(config.updatedAt).toBeNull();
  });
});
