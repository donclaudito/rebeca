/**
 * Formatação pt-BR. Toda string que o usuário lê passa por aqui — nenhum número formatado à mão,
 * nenhuma data no formato americano.
 */

const compact = new Intl.NumberFormat('pt-BR', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

const integer = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });

const brl = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
});

const brlCents = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const usd = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const oneDecimal = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** `4800000` → `"4,8 mi"` */
export function formatCompact(value: number): string {
  return compact.format(value);
}

/** `1234` → `"1.234"` */
export function formatInt(value: number): string {
  return integer.format(value);
}

/** `2450` → `"R$ 2.450"` */
export function formatBrl(value: number): string {
  return brl.format(value);
}

/** `0.42` → `"R$ 0,42"` */
export function formatBrlCents(value: number): string {
  return brlCents.format(value);
}

/** `12.4` → `"US$ 12,40"` */
export function formatUsd(value: number): string {
  return usd.format(value);
}

/** `31.4` → `"31,4%"` */
export function formatPct(value: number): string {
  return `${oneDecimal.format(value)}%`;
}

/** `1.8` → `"1,8×"` — usado em retorno sobre custo. */
export function formatRatio(value: number): string {
  return `${oneDecimal.format(value)}×`;
}

/** `12` → `"+12%"` · `-4` → `"-4%"` · `0` → `"0%"` */
export function formatSignedPct(value: number): string {
  if (value === 0) return '0%';
  const rounded = Math.round(value);
  return `${rounded > 0 ? '+' : '−'}${Math.abs(rounded)}%`;
}

/** `212` → `"3:32"` · `3950` → `"1:05:50"` */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}

/** `"12.4 min"` — usado quando a unidade é hora/minuto, não relógio. */
export function formatMinutes(value: number): string {
  return `${oneDecimal.format(value)} min`;
}

/** `"segunda-feira"` a partir do índice 0=domingo. */
export const WEEKDAY_LONG = [
  'domingo',
  'segunda-feira',
  'terça-feira',
  'quarta-feira',
  'quinta-feira',
  'sexta-feira',
  'sábado',
] as const;

/** `"Seg"`, `"Ter"`, ... */
export const WEEKDAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'] as const;
