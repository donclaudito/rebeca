/**
 * Nome determinístico por hash de entrada.
 *
 * A regra do projeto é explícita: `hash = sha256(artefato de entrada + versão do prompt + id do
 * provedor/modelo + parâmetros)` e **mesma entrada ⇒ mesmo nome**. É isso que faz três coisas de uma vez:
 *
 * 1. **Idempotência** (invariante: reexecutar não gasta de novo) — o pipeline calcula o hash antes de
 *    chamar o provedor e, se o ativo já existe com aquele hash, reusa o arquivo.
 * 2. **Fim do `final_v2_final.mp4`** — o nome do arquivo *é* a identidade do conteúdo. Não há nome
 *    escolhido por humano no caminho crítico, então não há nome que minta sobre o que o arquivo é.
 * 3. **Auditoria** — dá para refazer a conta do nome a partir do manifesto e provar que o arquivo na
 *    pasta corresponde ao que foi pedido.
 *
 * `HASH_SCHEMA` é deliberado: se um dia a forma do hash mudar, o número sobe e **todos** os nomes mudam
 * de uma vez. Reaproveitar nome antigo com regra nova é a receita para reusar o ativo errado.
 */

import { createHash } from 'node:crypto';

export const HASH_SCHEMA = 1;

export interface AssetHashInput {
  readonly stage: string;
  /** Versão do prompt que originou o pedido. */
  readonly promptVersion: string;
  readonly providerId: string;
  readonly model: string;
  /**
   * Artefato de entrada: o texto da fala, o prompt de imagem, o hash da imagem anterior…
   *
   * **Nunca um caminho absoluto.** `/home/ana/...` e `E:\...` produzem hashes diferentes para o mesmo
   * conteúdo, e o nome do arquivo deixaria de ser o mesmo entre máquinas — quebrando a idempotência
   * exatamente onde ela importa (rodar de novo depois de mover o repositório).
   */
  readonly input: unknown;
  readonly params: Readonly<Record<string, unknown>>;
}

/**
 * Serialização canônica: chaves ordenadas, recursivamente.
 *
 * Sem ordenar, `{a:1,b:2}` e `{b:2,a:1}` dariam hashes diferentes para o mesmo pedido — e o pipeline
 * pagaria duas vezes pelo mesmo ativo só porque alguém reordenou um objeto.
 */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(normalize(value)) ?? 'null';
}

function normalize(value: unknown): unknown {
  if (value === null) return null;

  if (Array.isArray(value)) return value.map((item) => normalize(item));

  if (value instanceof Date) return value.toISOString();

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) {
      const normalized = normalize(record[key]);
      // `undefined` não existe em JSON; descartar é o mesmo que já acontece na serialização, e mantém
      // `{a:1}` e `{a:1,b:undefined}` com o mesmo hash — que é o comportamento desejado.
      if (normalized !== undefined) out[key] = normalized;
    }
    return out;
  }

  if (typeof value === 'number' && !Number.isFinite(value)) return `<${String(value)}>`;
  if (typeof value === 'function' || typeof value === 'symbol') return '<ignorado>';

  return value;
}

/** sha256 completo (64 hex) do pedido. É o que fica no manifesto para auditoria. */
export function assetFingerprint(input: AssetHashInput): string {
  const payload = canonicalJson({
    hashSchema: HASH_SCHEMA,
    stage: input.stage,
    promptVersion: input.promptVersion,
    providerId: input.providerId,
    model: input.model,
    input: input.input,
    params: input.params,
  });
  return createHash('sha256').update(payload, 'utf8').digest('hex');
}

/** Os 8 primeiros hex — o que entra no nome do arquivo. */
export function assetHash(input: AssetHashInput): string {
  return assetFingerprint(input).slice(0, 8);
}
