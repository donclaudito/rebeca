/**
 * Configuração de IA editável pela tela de Configurações: chaves, endereços e escolha de modelo.
 *
 * ## O que isto é — e o que não é
 *
 * É um **arquivo local, fora do controle de versão** (`.rebeca/segredos/llm.json`, já ignorado pelo
 * git), que permite ligar o app sem editar `.env` e reiniciar. É a peça que faz o produto funcionar
 * na máquina de quem opera.
 *
 * **Não é um cofre.** A skill `rebeca-seguranca` exige segredo cifrado em repouso, em cofre gerenciado
 * — e isso vale para o token OAuth do YouTube, que é o ativo crítico. Aqui o risco é diferente
 * (chave de LLM é gasto, não é falar com a audiência de outra pessoa), mas a diferença **não** autoriza
 * fingir que há cifra onde não há. Decisões concretas, todas declaradas:
 *
 * 1. **A escrita é desabilitada quando o app está publicado.** O endpoint que grava segredo só
 *    responde fora da Vercel (ou com `REBECA_SETTINGS_WRITE=1`). Rota pública que aceita chave de API
 *    de qualquer visitante é vulnerabilidade, não funcionalidade — e não existe autenticação nesta
 *    fase (D3 aberta).
 * 2. **A chave nunca volta para o navegador.** A leitura devolve apenas um rótulo mascarado
 *    (`••••abcd`) e um indicador de presença. Não existe rota que devolva o valor.
 * 3. **Nunca entra em log, prompt ou mensagem de erro.** O mesmo cuidado do resto da camada.
 * 4. **Endereço de provedor passa por validação de SSRF.** Deixar o usuário digitar URL arbitrária
 *    que o servidor acessa é o vetor clássico: `169.254.169.254`, `localhost`, faixa privada. Ver
 *    `assertSafeProviderUrl`.
 * 5. **Em produção, o lugar do segredo é o gerenciador de segredos** (variável de ambiente da Vercel
 *    ou cofre). Este arquivo é o caminho de desenvolvimento, e a interface diz isso ao usuário.
 */

import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { AiError, type AiTier } from '../../src/ai/contract';

/* =============================================================================
   Forma da configuração
   ============================================================================= */

export interface ProviderConfig {
  /** Chave de API. **Nunca** sai do servidor: a leitura devolve só a máscara. */
  apiKey?: string;
  /** Endereço do provedor. Vazio = usa o padrão do catálogo. */
  baseUrl?: string;
}

export interface AiUserConfig {
  readonly providers: Record<string, ProviderConfig>;
  /** Modelo por nível, no formato `provedor:modelo`. */
  readonly models: Partial<Record<AiTier, string>>;
  /**
   * Modelo por **função**, no formato `provedor:modelo`. Tem precedência sobre o nível.
   *
   * É o que permite "diferenciar cada LLM" de verdade: o nível agrupa funções por tipo de trabalho,
   * e este mapa existe para o caso em que uma função específica precisa de outro modelo.
   */
  readonly functionModels: Partial<Record<string, string>>;
  /**
   * Decisões que o produto exige que sejam **explícitas do dono**, e não padrão silencioso.
   * Ficam aqui para serem registradas na tela em vez de exigirem edição de arquivo no servidor.
   */
  readonly allowUnverifiedMinorPolicy: boolean;
  readonly allowUnpricedModel: boolean;
  readonly allowNoLedger: boolean;
  readonly updatedAt: string | null;
}

const EMPTY: AiUserConfig = {
  providers: {},
  models: {},
  functionModels: {},
  allowUnverifiedMinorPolicy: false,
  allowUnpricedModel: false,
  allowNoLedger: false,
  updatedAt: null,
};

function rootDir(): string {
  return process.env.REBECA_ROOT ? resolve(process.env.REBECA_ROOT) : process.cwd();
}

/** Caminho do arquivo de configuração. `REBECA_SETTINGS_FILE` permite redirecionar (usado em teste). */
export function configPath(): string {
  const configured = process.env.REBECA_SETTINGS_FILE;
  if (configured) return resolve(configured);
  return join(rootDir(), '.rebeca', 'segredos', 'llm.json');
}

/**
 * `true` quando este ambiente aceita gravar segredo pela interface.
 *
 * Fora da Vercel, sim: é a máquina de quem opera. Na Vercel, **não** por padrão — publicar uma rota
 * que aceita chave de API de qualquer visitante seria abrir a conta do dono. Quem quiser ligar assume
 * a decisão com `REBECA_SETTINGS_WRITE=1`, e a interface avisa.
 */
export function settingsWritable(): boolean {
  if (process.env.REBECA_SETTINGS_WRITE === '1') return true;
  return !process.env.VERCEL;
}

/** `true` quando o app está publicado (contexto em que o segredo deve vir do gerenciador de segredos). */
export function isHosted(): boolean {
  return Boolean(process.env.VERCEL);
}

/* =============================================================================
   Leitura e escrita
   ============================================================================= */

function coerce(raw: unknown): AiUserConfig {
  if (typeof raw !== 'object' || raw === null) return EMPTY;
  const record = raw as Record<string, unknown>;

  const providers: Record<string, ProviderConfig> = {};
  const rawProviders = record['providers'];
  if (typeof rawProviders === 'object' && rawProviders !== null) {
    for (const [id, value] of Object.entries(rawProviders as Record<string, unknown>)) {
      if (typeof value !== 'object' || value === null) continue;
      const entry = value as Record<string, unknown>;
      const config: ProviderConfig = {};
      if (typeof entry['apiKey'] === 'string' && entry['apiKey'].trim().length > 0) {
        config.apiKey = entry['apiKey'].trim();
      }
      if (typeof entry['baseUrl'] === 'string' && entry['baseUrl'].trim().length > 0) {
        config.baseUrl = entry['baseUrl'].trim();
      }
      providers[id] = config;
    }
  }

  const models: Partial<Record<AiTier, string>> = {};
  const rawModels = record['models'];
  if (typeof rawModels === 'object' && rawModels !== null) {
    for (const tier of ['raciocinio', 'criativo', 'rapido', 'visao'] as const) {
      const value = (rawModels as Record<string, unknown>)[tier];
      if (typeof value === 'string' && value.includes(':')) models[tier] = value.trim();
    }
  }

  const functionModels: Record<string, string> = {};
  const rawFunctionModels = record['functionModels'];
  if (typeof rawFunctionModels === 'object' && rawFunctionModels !== null) {
    for (const [id, value] of Object.entries(rawFunctionModels as Record<string, unknown>)) {
      if (typeof value === 'string' && value.includes(':')) functionModels[id] = value.trim();
    }
  }

  return {
    providers,
    models,
    functionModels,
    allowUnverifiedMinorPolicy: record['allowUnverifiedMinorPolicy'] === true,
    allowUnpricedModel: record['allowUnpricedModel'] === true,
    allowNoLedger: record['allowNoLedger'] === true,
    updatedAt: typeof record['updatedAt'] === 'string' ? record['updatedAt'] : null,
  };
}

let cached: AiUserConfig | null = null;

/** Lê a configuração. Arquivo ausente ou ilegível devolve a configuração vazia — nunca lança. */
export function loadConfig(): AiUserConfig {
  if (cached) return cached;
  const path = configPath();
  if (!existsSync(path)) {
    cached = EMPTY;
    return cached;
  }
  try {
    cached = coerce(JSON.parse(readFileSync(path, 'utf8')) as unknown);
  } catch {
    // Arquivo corrompido não pode derrubar a geração: cai para vazio e o painel mostra "não
    // configurado". O operador reconfigura; nada de segredo é perdido em silêncio porque o arquivo
    // continua no disco para inspeção manual.
    cached = EMPTY;
  }
  return cached;
}

/** Só para teste: descarta o cache em memória. */
export function resetConfigCache(): void {
  cached = null;
}

export interface SaveResult {
  readonly changed: string[];
  readonly updatedAt: string;
}

/**
 * Grava a configuração, fazendo merge com o que já existe.
 *
 * `apiKey: null` remove a chave; `apiKey` ausente preserva a atual. Essa distinção importa: sem ela,
 * salvar o formulário com o campo de chave em branco (porque a tela nunca recebe o valor) apagaria a
 * chave que o usuário acabou de cadastrar.
 */
export function saveConfig(patch: unknown, now: Date = new Date()): SaveResult {
  if (!settingsWritable()) {
    throw new AiError(
      {
        code: 'nao-autorizado',
        message:
          'Este ambiente não aceita gravar configuração de IA pela interface. Use o gerenciador de segredos do servidor (variáveis de ambiente).',
        detail: 'escrita de configuração desabilitada (ambiente publicado sem REBECA_SETTINGS_WRITE=1)',
        retryable: false,
      },
      403,
    );
  }

  if (typeof patch !== 'object' || patch === null) {
    throw new AiError(
      { code: 'entrada-invalida', message: 'A configuração chegou em formato inesperado.', retryable: false },
      400,
    );
  }

  const current = loadConfig();
  const incoming = patch as Record<string, unknown>;
  const changed: string[] = [];

  const providers: Record<string, ProviderConfig> = { ...current.providers };
  const incomingProviders = incoming['providers'];
  if (incomingProviders !== undefined) {
    if (typeof incomingProviders !== 'object' || incomingProviders === null) {
      throw new AiError(
        { code: 'entrada-invalida', message: 'A lista de provedores está em formato inesperado.', retryable: false },
        400,
      );
    }
    for (const [id, value] of Object.entries(incomingProviders as Record<string, unknown>)) {
      if (typeof value !== 'object' || value === null) continue;
      const entry = value as Record<string, unknown>;
      const next: ProviderConfig = { ...(providers[id] ?? {}) };

      if (entry['apiKey'] === null) {
        delete next.apiKey;
        changed.push(`${id}: chave removida`);
      } else if (typeof entry['apiKey'] === 'string') {
        const key = entry['apiKey'].trim();
        if (key.length > 0) {
          assertPlausibleKey(key);
          next.apiKey = key;
          changed.push(`${id}: chave definida`);
        }
        // String vazia = "não mexi no campo"; preserva a chave atual de propósito.
      }

      if (entry['baseUrl'] === null) {
        delete next.baseUrl;
        changed.push(`${id}: endereço restaurado para o padrão`);
      } else if (typeof entry['baseUrl'] === 'string') {
        const url = entry['baseUrl'].trim();
        if (url.length === 0) {
          delete next.baseUrl;
        } else {
          next.baseUrl = assertSafeProviderUrl(url, { allowLocal: !isHosted() });
          changed.push(`${id}: endereço alterado`);
        }
      }

      providers[id] = next;
    }
  }

  const models: Partial<Record<AiTier, string>> = { ...current.models };
  const incomingModels = incoming['models'];
  if (typeof incomingModels === 'object' && incomingModels !== null) {
    for (const [tier, value] of Object.entries(incomingModels as Record<string, unknown>)) {
      if (!['raciocinio', 'criativo', 'rapido', 'visao'].includes(tier)) continue;
      if (value === null || value === '') {
        delete models[tier as AiTier];
        changed.push(`nível ${tier}: voltou ao padrão`);
      } else if (typeof value === 'string' && value.includes(':')) {
        models[tier as AiTier] = assertModelSpec(value);
        changed.push(`nível ${tier}: ${value}`);
      }
    }
  }

  // Cópia explícita em vez de espalhamento: `Partial<Record<string, string>>` espalhado produz
  // `string | undefined` em cada chave, e o compilador recusa. Filtrar aqui também garante que só
  // entra valor de fato texto.
  const functionModels: Record<string, string> = {};
  for (const [id, spec] of Object.entries(current.functionModels)) {
    if (typeof spec === 'string' && spec.length > 0) functionModels[id] = spec;
  }
  const incomingFunctionModels = incoming['functionModels'];
  if (typeof incomingFunctionModels === 'object' && incomingFunctionModels !== null) {
    for (const [id, value] of Object.entries(incomingFunctionModels as Record<string, unknown>)) {
      if (value === null || value === '') {
        if (functionModels[id]) {
          delete functionModels[id];
          changed.push(`função ${id}: voltou ao modelo do nível`);
        }
      } else if (typeof value === 'string' && value.includes(':')) {
        functionModels[id] = assertModelSpec(value);
        changed.push(`função ${id}: ${value}`);
      }
    }
  }

  const flag = (name: 'allowUnverifiedMinorPolicy' | 'allowUnpricedModel' | 'allowNoLedger'): boolean => {
    const value = incoming[name];
    if (typeof value !== 'boolean') return current[name];
    if (value !== current[name]) changed.push(`${name}: ${value ? 'ligado' : 'desligado'}`);
    return value;
  };

  const next: AiUserConfig = {
    providers,
    models,
    functionModels,
    allowUnverifiedMinorPolicy: flag('allowUnverifiedMinorPolicy'),
    allowUnpricedModel: flag('allowUnpricedModel'),
    allowNoLedger: flag('allowNoLedger'),
    updatedAt: now.toISOString(),
  };

  writeAtomically(next);
  cached = next;
  return { changed, updatedAt: next.updatedAt ?? now.toISOString() };
}

/**
 * Grava em arquivo temporário e renomeia.
 *
 * Sem isso, uma queda no meio da escrita deixaria configuração truncada — e o arquivo guarda as
 * chaves. Renomear é atômico no mesmo sistema de arquivos. Grava dentro de `.rebeca/segredos/`, que o
 * observador do Vite já ignora (gravação atômica na raiz já derrubou o dev server uma vez).
 */
function writeAtomically(config: AiUserConfig): void {
  const path = configPath();
  mkdirSync(dirname(path), { recursive: true });
  const temp = `${path}.${process.pid}.tmp`;
  try {
    writeFileSync(temp, `${JSON.stringify(config, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
    renameSync(temp, path);
  } catch (error) {
    try {
      rmSync(temp, { force: true });
    } catch {
      /* limpeza best-effort */
    }
    throw new AiError(
      {
        code: 'entrada-invalida',
        message: 'Não foi possível gravar a configuração no servidor.',
        detail: error instanceof Error ? error.message.slice(0, 200) : 'falha de escrita',
        retryable: true,
      },
      500,
    );
  }
}

/* =============================================================================
   Validações
   ============================================================================= */

/** Chave plausível: corta digitação errada e valor colado pela metade antes de virar chamada paga. */
function assertPlausibleKey(key: string): void {
  if (key.length < 12) {
    throw new AiError(
      { code: 'entrada-invalida', message: 'A chave parece curta demais. Confira se colou o valor completo.', retryable: false },
      400,
    );
  }
  if (/\s/.test(key)) {
    throw new AiError(
      { code: 'entrada-invalida', message: 'A chave contém espaço ou quebra de linha — copie só o valor.', retryable: false },
      400,
    );
  }
  if (key.length > 400) {
    throw new AiError(
      { code: 'entrada-invalida', message: 'A chave é longa demais para ser uma credencial.', retryable: false },
      400,
    );
  }
}

/** `provider:model`, com provedor conhecido e modelo não vazio. */
function assertModelSpec(spec: string): string {
  const separator = spec.indexOf(':');
  const provider = spec.slice(0, separator).trim();
  const model = spec.slice(separator + 1).trim();
  const known = ['openai', 'anthropic', 'deepseek', 'google', 'openrouter', 'simulado'];
  if (!known.includes(provider)) {
    throw new AiError(
      {
        code: 'entrada-invalida',
        message: `Provedor desconhecido: "${provider}".`,
        detail: `aceitos: ${known.join(', ')}`,
        retryable: false,
      },
      400,
    );
  }
  if (model.length === 0 || model.length > 120) {
    throw new AiError(
      { code: 'entrada-invalida', message: 'O nome do modelo precisa ter entre 1 e 120 caracteres.', retryable: false },
      400,
    );
  }
  return `${provider}:${model}`;
}

const METADATA_HOSTS = new Set([
  'metadata.google.internal',
  'metadata.goog',
  'instance-data',
  '169.254.169.254',
]);

/** Faixas que nunca devem ser alcançáveis a partir de um endereço digitado na interface. */
function isPrivateOrLoopbackHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');

  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal')) return true;
  if (host === '::1' || host === '0:0:0:0:0:0:0:1') return true;
  if (host.startsWith('fc') || host.startsWith('fd')) return true; // IPv6 unique local
  if (host.startsWith('fe80')) return true; // IPv6 link-local
  if (host === '0.0.0.0') return true;

  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (ipv4) {
    const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
    if (a === 127 || a === 10 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  }

  return false;
}

/**
 * Valida o endereço de provedor digitado na interface — guarda contra SSRF.
 *
 * A skill `rebeca-seguranca` (princípio 6) é direta: URL vinda de fora não se confia, e a lista de
 * bloqueios inclui loopback, link-local, faixa privada e **endereço de metadata de nuvem** — que é o
 * caminho mais curto de "digitar um endereço" para "ler credencial da instância".
 *
 * `allowLocal` existe porque um provedor **local** (modelo rodando na própria máquina) é caso de uso
 * legítimo de quem opera. Ele só é permitido quando o app **não** está publicado; em ambiente
 * publicado, `allowLocal` é `false` e endereço local é recusado.
 *
 * LIMITE DECLARADO: nomes de host não são resolvidos aqui — resolver já seria fazer a requisição que
 * se quer evitar, e DNS rebinding não é mitigado por checagem de string. O que este portão garante é
 * recusar o que é literalmente interno, exigir HTTPS em produção e impedir credencial embutida na
 * URL. Defesa completa exige allowlist de host, que é decisão de produto (endpoints fixos ou livres).
 */
export function assertSafeProviderUrl(raw: string, options: { allowLocal: boolean }): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new AiError(
      { code: 'entrada-invalida', message: 'O endereço do provedor não é uma URL válida.', retryable: false },
      400,
    );
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new AiError(
      {
        code: 'entrada-invalida',
        message: 'O endereço do provedor precisa usar http ou https.',
        detail: `protocolo recebido: ${url.protocol}`,
        retryable: false,
      },
      400,
    );
  }

  if (url.username.length > 0 || url.password.length > 0) {
    throw new AiError(
      {
        code: 'entrada-invalida',
        message: 'Não coloque usuário nem senha no endereço do provedor — a credencial vai no cabeçalho, não na URL.',
        retryable: false,
      },
      400,
    );
  }

  if (METADATA_HOSTS.has(url.hostname.toLowerCase())) {
    throw new AiError(
      {
        code: 'entrada-invalida',
        message: 'Este endereço é de metadados de infraestrutura e não pode ser usado como provedor.',
        retryable: false,
      },
      400,
    );
  }

  const local = isPrivateOrLoopbackHost(url.hostname);
  if (local && !options.allowLocal) {
    throw new AiError(
      {
        code: 'entrada-invalida',
        message:
          'Endereço interno ou local não é aceito neste ambiente. Use o endereço público do provedor.',
        detail: `host recusado: ${url.hostname}`,
        retryable: false,
      },
      400,
    );
  }

  // Em ambiente publicado, só HTTPS: chave de API em texto claro na rede é vazamento.
  if (!options.allowLocal && url.protocol !== 'https:') {
    throw new AiError(
      {
        code: 'entrada-invalida',
        message: 'Em ambiente publicado, o endereço do provedor precisa ser https.',
        retryable: false,
      },
      400,
    );
  }

  return url.toString();
}

/* =============================================================================
   Acesso resolvido (usado pelo handler)
   ============================================================================= */

export interface ResolvedProvider {
  readonly apiKey: string;
  readonly apiKeySource: 'configuracao' | 'ambiente' | 'ausente';
  readonly baseUrl: string;
  readonly baseUrlSource: 'configuracao' | 'padrao';
}

/**
 * Resolve chave e endereço de um provedor.
 *
 * Precedência: **configuração salva na tela** > variável de ambiente > padrão do catálogo.
 *
 * A tela ganhar da variável de ambiente é escolha deliberada: quem acabou de colar a chave na
 * interface espera que ela valha. Se o ambiente ganhasse, o usuário salvaria, testaria e veria falhar
 * com a chave antiga — sem nada na tela explicando por quê.
 */
export function resolveProvider(
  provider: string,
  envKey: string,
  defaultBaseUrl: string,
): ResolvedProvider {
  const config = loadConfig().providers[provider] ?? {};
  const fromConfig = config.apiKey?.trim() ?? '';
  const fromEnv = (process.env[envKey] ?? '').trim();

  const apiKey = fromConfig.length > 0 ? fromConfig : fromEnv;
  const apiKeySource: ResolvedProvider['apiKeySource'] =
    fromConfig.length > 0 ? 'configuracao' : fromEnv.length > 0 ? 'ambiente' : 'ausente';

  const baseUrl = config.baseUrl && config.baseUrl.length > 0 ? config.baseUrl : defaultBaseUrl;

  return {
    apiKey,
    apiKeySource,
    baseUrl,
    baseUrlSource: config.baseUrl && config.baseUrl.length > 0 ? 'configuracao' : 'padrao',
  };
}

/** Máscara para exibição. Nunca devolve o valor — só o suficiente para o humano reconhecer a chave. */
export function maskSecret(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) return '';
  if (trimmed.length <= 4) return '••••';
  return `••••${trimmed.slice(-4)}`;
}
