// Instala uma chave de provedor na configuração de IA **sem nunca imprimir o valor**.
//
//   node .tools/instalar-chave-ia.mjs <arquivo> <provedor> [--base-url <url>]
//
// Exemplo:
//   node .tools/instalar-chave-ia.mjs ./minha-chave.txt openai
//
// Para que serve: a chave não deve passar por chat, issue, log de terminal nem variável de ambiente
// compartilhada. Este script lê o arquivo, valida o formato (comprimento, ausência de espaço) e grava
// direto em `.rebeca/segredos/llm.json` — arquivo ignorado pelo git. A saída traz apenas a máscara.
//
// O caminho normal, no dia a dia, é colar a chave na própria tela do app
// (Configurações → Inteligência artificial). Este script existe para automação e para o caso de a
// chave estar num arquivo que não se quer abrir.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const args = process.argv.slice(2);
const file = args[0];
const provider = args[1];
const baseUrlIndex = args.indexOf('--base-url');
const baseUrl = baseUrlIndex === -1 ? null : args[baseUrlIndex + 1];

if (!file || !provider) {
  console.error('uso: node .tools/instalar-chave-ia.mjs <arquivo> <provedor> [--base-url <url>]');
  process.exit(2);
}

const raw = readFileSync(file, 'utf8');
const lines = raw
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith('#'));

if (lines.length === 0) {
  console.error('arquivo sem valor utilizável');
  process.exit(1);
}

// Aceita valor puro ou `NOME=valor` (formato .env), com ou sem aspas.
const first = lines[0];
const eq = first.indexOf('=');
const apiKey = (eq === -1 ? first : first.slice(eq + 1)).trim().replace(/^["']|["']$/g, '');

// Mesmas regras do servidor: chave plausível, sem espaço, tamanho razoável.
if (apiKey.length < 12 || apiKey.length > 400) {
  console.error(`comprimento inesperado para uma credencial: ${apiKey.length}`);
  process.exit(1);
}
if (/\s/.test(apiKey)) {
  console.error('o valor contém espaço ou quebra de linha');
  process.exit(1);
}

const configPath = process.env.REBECA_SETTINGS_FILE
  ? resolve(process.env.REBECA_SETTINGS_FILE)
  : join(process.cwd(), '.rebeca', 'segredos', 'llm.json');

let config = {
  providers: {},
  models: {},
  functionModels: {},
  allowUnverifiedMinorPolicy: false,
  allowUnpricedModel: false,
  allowNoLedger: false,
  updatedAt: null,
};

if (existsSync(configPath)) {
  try {
    config = { ...config, ...JSON.parse(readFileSync(configPath, 'utf8')) };
    config.providers = config.providers ?? {};
  } catch {
    console.error('configuração existente ilegível; abortando para não sobrescrever em cima de lixo');
    process.exit(1);
  }
}

config.providers[provider] = {
  ...(config.providers[provider] ?? {}),
  apiKey,
  ...(baseUrl ? { baseUrl } : {}),
};
config.updatedAt = new Date().toISOString();

mkdirSync(dirname(configPath), { recursive: true });
const temp = `${configPath}.${process.pid}.tmp`;
writeFileSync(temp, `${JSON.stringify(config, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
renameSync(temp, configPath);

// Saída: só o que não é segredo.
const mask = apiKey.length <= 4 ? '****' : `****${apiKey.slice(-4)}`;
console.log(`gravado em ${configPath}`);
console.log(`provedor: ${provider}`);
console.log(`chave: ${mask} (comprimento ${apiKey.length})`);
console.log(`endereço: ${baseUrl ?? '(padrão do catálogo)'}`);
