/**
 * Configuração da autenticação no servidor.
 *
 * Duas leituras de ambiente, e só duas:
 *
 * - `GOOGLE_CLIENT_ID` — público (vai no bundle do navegador de propósito, é o `aud` que o servidor
 *   confere). Ausente ⇒ **nenhuma rota de IA ou de mídia responde**, porque sem ele não existe `aud`
 *   para verificar token nenhum. Isto é falha fechada deliberada: a alternativa — deixar as rotas
 *   abertas quando a configuração falta — transformaria um erro de deploy em porta aberta para a
 *   chave paga, que é exatamente o achado T9 que o `ADR-014` fecha.
 * - `REBECA_ALLOWED_SUBS` — **é o controle de acesso**, fica só no servidor. Ausente ⇒ lista vazia ⇒
 *   ninguém autorizado. É o estado normal do **primeiro** login: o dono ainda não sabia o próprio
 *   `sub`. A tela de entrada mostra o `sub` para ele colar na variável.
 */

import { GOOGLE_SCRIPT_URL, type AuthConfigView } from '../../src/auth/contract.js';
import { valorDoEnvDeDesenvolvimento } from '../dev-env.js';

/**
 * Client ID público, ou `null` quando o ambiente não o define (ou define vazio/espaços).
 *
 * Em **desenvolvimento**, o valor vem do `.env` lido na hora (`server/dev-env.ts`) — é o arquivo que o
 * runbook manda editar, e a leitura ao vivo faz a edição valer na requisição seguinte, sem reiniciar o
 * servidor. Em produção e em teste, vem do ambiente do processo, e só dele.
 */
export function googleClientId(env: NodeJS.ProcessEnv = process.env): string | null {
  const doArquivo = env === process.env ? valorDoEnvDeDesenvolvimento('GOOGLE_CLIENT_ID') : null;
  const raw = doArquivo ?? env['GOOGLE_CLIENT_ID'];
  if (raw === undefined) return null;
  const trimmed = raw.trim();
  return trimmed.length === 0 ? null : trimmed;
}

/**
 * O que `GET /api/auth/config` devolve.
 *
 * Não inclui a lista de `sub`s — nem mascarada, **nem a contagem** (que saiu daqui no `QA-014`: é
 * informação sobre quem tem acesso, e um visitante anônimo não tem uso para ela). O navegador só
 * precisa do Client ID para desenhar o botão.
 */
export function authConfigView(env: NodeJS.ProcessEnv = process.env): AuthConfigView {
  return {
    clientId: googleClientId(env),
    googleScriptUrl: GOOGLE_SCRIPT_URL,
  };
}
