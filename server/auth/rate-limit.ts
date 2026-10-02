/**
 * Limite de uso por identidade.
 *
 * O `ADR-014` pede, como defesa em profundidade, **rate limit por `sub`** além do teto de gasto. Os
 * dois resolvem problemas diferentes, e confundir os dois seria pior que não ter nenhum:
 *
 * - o **teto de gasto** (`src/ai/limits.ts`) é o guarda do dinheiro: ele conta dólares e para a
 *   chamada antes de o provedor ser acionado;
 * - o **rate limit** é o guarda do serviço: ele conta **chamadas** e existe para uma sessão em laço
 *   não consumir a cota e a paciência do servidor — inclusive com chamadas que não custam nada.
 *
 * O contador é **em memória do processo**, e isso é declarado, não escondido: em serverless cada
 * invocação pode nascer com o contador zerado (limite por instância, não por conta). Dizer que ele é
 * durável seria a mesma mentira que o livro de custos já se recusa a contar sobre si mesmo. Um limite
 * de verdade, compartilhado, exige banco — é a decisão D1, ainda aberta.
 *
 * Os números vivem **em código**, no mesmo padrão dos tetos de gasto: mudá-los exige revisão, não uma
 * variável esquecida no painel.
 */

export interface RateLimitPolicy {
  /** Chamadas permitidas dentro da janela. */
  readonly limit: number;
  readonly windowMs: number;
}

/**
 * Política de **leitura**: 240 chamadas por minuto por identidade.
 *
 * Subiu de 60 para 240 depois do `QA-014`: a cota contava leitura e geração juntas, e uma tela de
 * mídia com 13 ativos gasta 13 requisições só para desenhar as prévias — duas telas abertas e um
 * `F5` chegavam perto do teto, com 429 em `GET` (que não gasta nada) como sintoma. O limite existe
 * para conter laço, não para atrapalhar uso legítimo.
 */
export const AUTH_RATE_LIMIT: RateLimitPolicy = { limit: 240, windowMs: 60_000 };

/**
 * Política de **geração**: 20 chamadas por minuto por identidade.
 *
 * As rotas que acionam provedor (gerar conteúdo, testar conexão, gerar thumbnail) têm cota **própria e
 * mais apertada**, contada em separado da leitura. É defesa em profundidade sobre o teto de gasto:
 * quem já passou pela lista de acesso ainda não deveria poder disparar 20 gerações pagas por minuto.
 */
export const AUTH_RATE_LIMIT_PAID: RateLimitPolicy = { limit: 20, windowMs: 60_000 };

/** Teto de identidades observadas ao mesmo tempo — a memória não é do atacante. */
export const AUTH_RATE_LIMIT_MAX_KEYS = 512;

/** Instantes das chamadas, por identidade. */
const hits = new Map<string, number[]>();

export interface RateLimitDecision {
  readonly allowed: boolean;
  /** Quanto falta para a chamada mais antiga sair da janela — o `Retry-After` honesto. */
  readonly retryAfterMs: number;
}

/**
 * Registra a chamada e diz se ela é permitida.
 *
 * A janela é deslizante: guarda os instantes das últimas chamadas daquela identidade e descarta o que
 * já saiu da janela. Janela fixa ("60 por minuto do relógio") deixaria passar 120 chamadas na virada
 * do minuto, que é justamente o pico que ela deveria conter.
 */
export function checkRateLimit(
  key: string,
  options: { readonly now?: number; readonly policy?: RateLimitPolicy } = {},
): RateLimitDecision {
  const policy = options.policy ?? AUTH_RATE_LIMIT;
  const now = options.now ?? Date.now();
  const inicio = now - policy.windowMs;

  const anteriores = (hits.get(key) ?? []).filter((instante) => instante > inicio);

  if (anteriores.length >= policy.limit) {
    const maisAntiga = anteriores[0] ?? now;
    hits.set(key, anteriores);
    return { allowed: false, retryAfterMs: Math.max(0, maisAntiga + policy.windowMs - now) };
  }

  anteriores.push(now);
  hits.set(key, anteriores);

  // Poda simples: quando o mapa cresce demais, as identidades sem chamada recente saem. Sem isto, um
  // atacante que só apresentasse tokens válidos de contas diferentes encheria a memória do processo.
  if (hits.size > AUTH_RATE_LIMIT_MAX_KEYS) {
    for (const [chave, instantes] of hits) {
      if (instantes.length === 0 || (instantes[instantes.length - 1] ?? 0) <= inicio) hits.delete(chave);
      if (hits.size <= AUTH_RATE_LIMIT_MAX_KEYS) break;
    }
  }

  return { allowed: true, retryAfterMs: 0 };
}

/** Só para teste: zera os contadores entre casos. */
export function resetRateLimits(): void {
  hits.clear();
}
