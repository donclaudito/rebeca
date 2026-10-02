// Instala a chave do provedor de MÍDIA (MiniMax) **sem nunca imprimir o valor**.
//
//   node .tools/instalar-chave-midia.mjs <arquivo> [--base-url <url>]
//
// Exemplo:
//   node .tools/instalar-chave-midia.mjs ./minha-chave-minimax.txt
//
// Por que existe: a camada de mídia lê a chave de `REBECA_MINIMAX_API_KEY` ou de
// `.rebeca/segredos/midia.json` (ignorado pelo git) — e **não existe campo na interface** para ela
// ainda. Sem este atalho, o único jeito seria colar a chave no terminal (fica no histórico) ou em
// texto claro no chat. Este script lê o valor de um arquivo, valida o formato e grava direto,
// imprimindo apenas a máscara — o mesmo contrato de `.tools/instalar-chave-ia.mjs`.
//
// O arquivo é lido a cada chamada pelo servidor (`server/media/config.ts` não faz cache), então a
// chave passa a valer sem reiniciar o `pnpm dev`.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const args = process.argv.slice(2);
const file = args[0];
const baseUrlIndex = args.indexOf('--base-url');
const baseUrl = baseUrlIndex === -1 ? null : args[baseUrlIndex + 1];

if (!file) {
  console.error('uso: node .tools/instalar-chave-midia.mjs <arquivo> [--base-url <url>]');
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

// Mesmas regras da camada de IA: chave plausível, sem espaço, tamanho razoável.
if (apiKey.length < 12 || apiKey.length > 400) {
  console.error(`comprimento inesperado para uma credencial: ${apiKey.length}`);
  process.exit(1);
}
if (/\s/.test(apiKey)) {
  console.error('o valor contém espaço ou quebra de linha');
  process.exit(1);
}

// O destino é o MESMO que `server/media/config.ts` lê: `<raiz>/.rebeca/segredos/midia.json`, com a
// raiz vindo de `REBECA_ROOT` — a sobreposição que o próprio pipeline usa nos testes. Inventar uma
// variável só deste script criaria um caminho que ninguém lê.
const root = process.env.REBECA_ROOT ? resolve(process.env.REBECA_ROOT) : process.cwd();
const configPath = join(root, '.rebeca', 'segredos', 'midia.json');

let config = {};
if (existsSync(configPath)) {
  try {
    config = JSON.parse(readFileSync(configPath, 'utf8'));
  } catch {
    console.error('configuração existente ilegível; abortando para não sobrescrever em cima de lixo');
    process.exit(1);
  }
}

config.minimax = {
  ...(config.minimax ?? {}),
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
console.log(`provedor: minimax (mídia)`);
console.log(`chave: ${mask} (comprimento ${apiKey.length})`);
console.log(`endereço: ${baseUrl ?? '(padrão: https://api.minimax.io)'}`);
console.log('o servidor lê este arquivo a cada chamada — não precisa reiniciar o pnpm dev');
