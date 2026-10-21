/**
 * Padrões e leitura de ambiente do app instalado.
 *
 * Mora em módulo próprio, e não dentro do `cli.ts`, por uma razão prática: o `cli.ts` **sobe o
 * servidor** quando é importado (ele é um ponto de entrada, não uma biblioteca). Testar a leitura de
 * `REBECA_PORT` importando o CLI significaria abrir uma porta de verdade no meio da suíte. Aqui as
 * funções são puras e o teste pode exercitá-las — inclusive os casos que, sem teste, viram surpresa em
 * produção: porta com texto colado (`8787abc`), porta fora da faixa e host que **não** é local.
 */

/** Porta padrão. Fora das faixas usuais: 5173 é o servidor de desenvolvimento, 3000/8080 vivem ocupadas. */
export const DEFAULT_PORT = 8787;

/**
 * Endereço padrão: **só o loopback**.
 *
 * Este servidor carrega a chave paga dos provedores e verifica o token do Google. Escutar em
 * `0.0.0.0` por padrão significaria que qualquer aparelho na mesma rede (Wi-Fi de casa, rede do
 * escritório, rede de um hotel) alcança o app — e a chave junto. Quem precisar expor de propósito
 * passa `REBECA_HOST`, e recebe um aviso na subida.
 */
export const DEFAULT_HOST = '127.0.0.1';

/** O host é local (e portanto o aviso de exposição não se aplica)? */
export function isLoopback(host: string): boolean {
  return host === '127.0.0.1' || host === 'localhost' || host === '::1';
}

/** Lê `REBECA_PORT`. Recusa texto que não seja número — `parseInt('8787abc')` devolveria 8787 calado. */
export function readPort(raw: string | undefined): number {
  const value = raw?.trim() ?? '';
  if (value.length === 0) return DEFAULT_PORT;

  if (!/^\d+$/.test(value)) {
    throw new Error(`REBECA_PORT inválida: "${raw}". Use um número de 1 a 65535.`);
  }

  const parsed = Number.parseInt(value, 10);
  if (parsed < 1 || parsed > 65_535) {
    throw new Error(`REBECA_PORT fora da faixa: "${raw}". Use um número de 1 a 65535.`);
  }
  return parsed;
}

/** Lê `REBECA_HOST`. Vazio conta como ausente — variável definida e em branco não é configuração. */
export function readHost(raw: string | undefined): string {
  const value = raw?.trim() ?? '';
  return value.length === 0 ? DEFAULT_HOST : value;
}
