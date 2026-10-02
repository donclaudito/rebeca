/**
 * De onde o **servidor de desenvolvimento** lê `GOOGLE_CLIENT_ID` e `REBECA_ALLOWED_SUBS`.
 *
 * ## O problema, medido (não deduzido)
 *
 * O Vite **não** injeta `.env` em `process.env`: ele lê os arquivos e devolve um objeto para quem
 * chamou `loadEnv` (a implementação instalada — `vite/dist/node/chunks/node.js`, função `loadEnv` —
 * só escreve três chaves em `process.env`: `VITE_USER_NODE_ENV`, `BROWSER` e `BROWSER_ARGS`). O
 * middleware de desenvolvimento roda no processo do Node e lê `process.env`. Daí a primeira versão
 * desta ponte: copiar os valores do arquivo para o processo na avaliação do `vite.config.ts`.
 *
 * A ponte **mentia em silêncio**, e o custo foi o dono do produto não conseguindo entrar no app:
 *
 * 1. Editar o `.env` e recarregar a página **não mudava nada** — medido com valor sentinela:
 *    `GET /api/auth/config` continuava devolvendo o valor antigo 7 segundos depois da edição. O Vite
 *    não reavalia o `vite.config.ts` quando o `.env` muda, então a ponte não rodava de novo.
 * 2. O sintoma na tela era **"conta ainda não autorizada"** com o `sub` certo na mão — ou seja, um
 *    defeito de encanamento disfarçado de defeito de acesso, que manda a pessoa procurar no lugar
 *    errado. Foi preciso reiniciar o `pnpm dev` na mão para a lista nova valer.
 *
 * ## O que ficou no lugar
 *
 * O valor é lido **do arquivo, na hora do uso**, com cache por `mtime` (barato: só relê quando o
 * arquivo muda). Assim, editar o `.env` passa a valer **na requisição seguinte**, sem reiniciar nada.
 * Em troca, a regra fica explícita: **em desenvolvimento o `.env` manda** para essas duas chaves.
 *
 * E onde **não** vale, de propósito:
 *
 * - **teste** (`VITEST` presente): a suíte define o que quer em `process.env`, e um `.env` de máquina
 *   de desenvolvimento não pode mudar o resultado dela — foi assim que uma chave real já quase entrou
 *   num teste pago neste projeto;
 * - **produção** (`VERCEL` presente): ali não existe o arquivo, e o lugar do valor é o ambiente do
 *   host. Ler arquivo em produção seria, no melhor caso, inútil; no pior, uma forma de alguém subir
 *   um `.env` junto do bundle e trocar a configuração por arquivo.
 *
 * A lista de chaves é **explícita**, e não "tudo que está no `.env`": copiar chave de provedor para o
 * processo é como um teste topa com credencial paga. Chave de IA entra pela tela de Configurações.
 */

import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

/** As duas chaves que este módulo administra no desenvolvimento. */
export const CHAVES_DO_SERVIDOR_NO_ENV = ['GOOGLE_CLIENT_ID', 'REBECA_ALLOWED_SUBS'] as const;

export type ChaveDoServidor = (typeof CHAVES_DO_SERVIDOR_NO_ENV)[number];

/**
 * Interpreta um arquivo `.env` no subconjunto que usamos.
 *
 * Regras: `#` inicia comentário (em linha própria ou depois do valor), `export CHAVE=` é aceito,
 * aspas simples ou duplas são removidas, e `=` dentro do valor é preservado. Não é um parser
 * completo de dotenv — é o suficiente para o arquivo que este projeto documenta, e é honesto sobre
 * isso: o que ele não entende, ele ignora em vez de inventar.
 */
export function interpretarEnv(conteudo: string): Record<string, string> {
  const valores: Record<string, string> = {};

  for (const linha of conteudo.split(/\r?\n/)) {
    const semEspaco = linha.trim();
    if (semEspaco.length === 0 || semEspaco.startsWith('#')) continue;

    const semExport = semEspaco.startsWith('export ') ? semEspaco.slice('export '.length).trim() : semEspaco;
    const separador = semExport.indexOf('=');
    if (separador <= 0) continue;

    const chave = semExport.slice(0, separador).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(chave)) continue;

    let valor = semExport.slice(separador + 1).trim();
    // Comentário só conta quando não está dentro de aspas.
    if (!valor.startsWith('"') && !valor.startsWith("'")) {
      const comentario = valor.indexOf('#');
      if (comentario >= 0) valor = valor.slice(0, comentario).trim();
    }
    if (
      (valor.startsWith('"') && valor.endsWith('"') && valor.length >= 2) ||
      (valor.startsWith("'") && valor.endsWith("'") && valor.length >= 2)
    ) {
      valor = valor.slice(1, -1);
    }

    valores[chave] = valor;
  }

  return valores;
}

interface Cache {
  readonly caminho: string;
  readonly mtimeMs: number;
  readonly valores: Record<string, string>;
}

let cache: Cache | null = null;

/** O `.env` só é consultado no servidor de desenvolvimento; nos outros dois casos devolve `null`. */
function caminhoDoEnvDeDesenvolvimento(): string | null {
  if (process.env['VITEST'] !== undefined) return null;
  if (process.env['VERCEL'] !== undefined) return null;
  const caminho = resolve(process.cwd(), '.env');
  return existsSync(caminho) ? caminho : null;
}

/**
 * Valor da chave no `.env`, ou `null` quando não há arquivo, a chave não existe ou o valor é vazio.
 *
 * `null` — e não string vazia — para o chamador distinguir "o arquivo não diz nada" de "o arquivo diz
 * que é vazio", que é a diferença entre cair para o ambiente e apagar o acesso de todo mundo.
 */
export function valorDoEnvDeDesenvolvimento(chave: ChaveDoServidor): string | null {
  const caminho = caminhoDoEnvDeDesenvolvimento();
  if (caminho === null) return null;

  try {
    const { mtimeMs } = statSync(caminho);
    if (cache === null || cache.caminho !== caminho || cache.mtimeMs !== mtimeMs) {
      cache = { caminho, mtimeMs, valores: interpretarEnv(readFileSync(caminho, 'utf8')) };
    }
    const valor = cache.valores[chave];
    if (valor === undefined) return null;
    const limpo = valor.trim();
    return limpo.length === 0 ? null : limpo;
  } catch {
    // Arquivo ilegível (permissão, corrida com um editor): segue o ambiente do processo. Nunca lança:
    // falhar aqui derrubaria a rota por causa de um arquivo de conveniência do desenvolvimento.
    return null;
  }
}

/** Só para teste: descarta o cache entre casos. */
export function resetEnvCacheForTests(): void {
  cache = null;
}
