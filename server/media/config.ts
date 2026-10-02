/**
 * Configuração dos provedores de mídia — **o segredo nunca sai do servidor**.
 *
 * Espelha a decisão do `ADR-007` para a camada de IA: a chave vive no servidor, e o navegador só recebe
 * **presença** e **máscara**. Nenhuma função deste arquivo devolve o valor da chave; `hasMiniMaxKey()` é o
 * que a tela pode perguntar.
 *
 * Ordem de leitura (a mesma da camada de IA, e pela mesma razão — variável de ambiente vence para
 * permitir CI e teste sem tocar em arquivo):
 *
 * 1. `REBECA_MINIMAX_API_KEY`
 * 2. `.rebeca/segredos/midia.json` → `{ "minimax": { "apiKey": "..." } }` (ignorado pelo git)
 *
 * Arquivo separado do `llm.json` de propósito: aquele é o schema da camada de IA (provedores, níveis,
 * modelo por função). Misturar mídia ali faria a tela de Configurações de IA ter de conhecer provedores
 * que ela não configura.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from './paths.js';

/** Base oficial da MiniMax. Sobreponível para teste — nunca para "apontar para outro provedor". */
export const MINIMAX_DEFAULT_BASE_URL = 'https://api.minimax.io';

export function mediaSecretsPath(): string {
  return join(repoRoot(), '.rebeca', 'segredos', 'midia.json');
}

interface MediaSecrets {
  readonly minimax?: { readonly apiKey?: unknown };
}

function readSecretsFile(): MediaSecrets {
  const path = mediaSecretsPath();
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as MediaSecrets;
  } catch {
    // Arquivo ilegível não pode derrubar o pipeline nem virar "sem chave" silencioso: quem chamou decide.
    return {};
  }
}

/** A chave, ou `null`. **Não** logue o retorno; use `hasMiniMaxKey()` para diagnóstico. */
export function miniMaxApiKey(): string | null {
  const fromEnv = process.env['REBECA_MINIMAX_API_KEY'];
  if (typeof fromEnv === 'string' && fromEnv.trim().length > 0) return fromEnv.trim();

  const fromFile = readSecretsFile().minimax?.apiKey;
  if (typeof fromFile === 'string' && fromFile.trim().length > 0) return fromFile.trim();

  return null;
}

/** O que a tela pode saber: existe chave? De onde veio? Nunca o valor. */
export function hasMiniMaxKey(): boolean {
  return miniMaxApiKey() !== null;
}

/** Máscara para exibição (`••••7890`). Nunca devolve a chave inteira, nem em log. */
export function maskedMiniMaxKey(): string {
  const key = miniMaxApiKey();
  if (key === null) return '';
  return key.length <= 4 ? '••••' : `••••${key.slice(-4)}`;
}

export function miniMaxBaseUrl(): string {
  const configured = process.env['REBECA_MINIMAX_BASE_URL'];
  if (typeof configured === 'string' && configured.trim().length > 0) return configured.trim().replace(/\/+$/, '');
  return MINIMAX_DEFAULT_BASE_URL;
}
