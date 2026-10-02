/**
 * Travas de custo e de abuso da camada de IA.
 *
 * Estes números **não são escolha de agente**: foram aprovados pelo dono do produto nesta sessão
 * (teto por chamada de US$ 0,05 e teto diário de US$ 1,00 — a opção recomendada, por ser segura para
 * texto/roteiro e por barrar chamada acidental cara). A skill `rebeca-arquiteto` é explícita: decisão
 * que gasta dinheiro é do humano, não do agente.
 *
 * Ficam em `src/ai/` (e não em `server/ai/`) de propósito: o **navegador precisa saber** o limite
 * para poder recusar antes de mandar a chamada e para mostrar o teto na tela. O servidor aplica a
 * mesma trava de novo — a do cliente é conveniência, a do servidor é a que vale.
 */

export const AI_LIMITS = {
  /**
   * Teto de custo **estimado** por chamada, em USD. Estimou acima disso? A chamada nem sai.
   *
   * A ordem importa: `estimateCost` roda **antes** do POST. Trava que só descobre o custo depois de
   * pagar não é trava, é relatório.
   */
  perCallUsd: 0.05,

  /** Teto de gasto **real** acumulado no dia, em USD. Somado por chamada, não por sessão. */
  dailyUsd: 1.0,

  /**
   * Tentativas por chamada. Duas: a primeira e **uma** correção quando a saída não passa no schema.
   * Sem laço: retry infinito em cima de saída inválida é como se queima orçamento.
   */
  maxAttempts: 2,

  /** Tempo máximo de uma chamada ao provedor. Acima disso, aborta — e não paga duas vezes. */
  requestTimeoutMs: 90_000,

  /**
   * Tempo máximo do **teste de conexão** — menor que o da geração, mas não apertado.
   *
   * Estava em 30 s fixos no código, e o dono do produto bateu nesse limite com o Google: a mensagem
   * dizia só "tempo esgotado", sem dizer de quanto tempo se tratava nem o que fazer. Modelo que
   * "pensa" consome orçamento de saída em raciocínio e pode passar de 30 s numa chamada de uma palavra.
   * 60 s dá folga para isso e mantém o teste como teste — se estourar de novo, o problema é outro
   * (rede, endereço ou modelo indisponível) e a mensagem diz isso.
   */
  testTimeoutMs: 60_000,

  /**
   * Tamanho máximo da entrada serializada. Entrada gigante é custo escondido e também vetor de
   * abuso: alguém colando 5 MB no campo de recado.
   */
  maxInputChars: 24_000,

  /** Tamanho máximo do recado do humano (o motivo da rejeição, por exemplo). */
  maxNoteChars: 2_000,
} as const;

/** Formata o teto para a interface, sem depender do formatador do app. */
export function formatUsdLimit(value: number): string {
  return `US$ ${value.toFixed(2).replace('.', ',')}`;
}
