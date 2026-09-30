/**
 * Datas do protótipo.
 *
 * A semana de referência é **sempre a semana corrente** (segunda a domingo, fuso local), para que o
 * app pareça vivo numa demonstração. Os textos de data são escritos à mão a partir dos componentes,
 * sem `toLocaleDateString`, para não depender do fuso do navegador.
 */

import { WEEKDAY_LONG, WEEKDAY_SHORT } from './format';

/** Data ISO (`YYYY-MM-DD`) sem passar por UTC — evita o clássico "volta um dia". */
export function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/** Segunda-feira 00:00 da semana de `date`. */
export function startOfWeek(date: Date = new Date()): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  // getDay(): 0 = domingo. Queremos segunda como primeiro dia.
  const shift = (d.getDay() + 6) % 7;
  return addDays(d, -shift);
}

/** `"10/03"` */
export function formatDayMonth(date: Date): string {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${d}/${m}`;
}

/** `"10/03/2026"` */
export function formatFullDate(date: Date): string {
  return `${formatDayMonth(date)}/${date.getFullYear()}`;
}

/** `"10/03 às 17:00"` */
export function formatDayMonthTime(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${formatDayMonth(date)} às ${h}:${min}`;
}

export function weekdayShort(date: Date): string {
  return WEEKDAY_SHORT[date.getDay()] ?? '';
}

export function weekdayLong(date: Date): string {
  return WEEKDAY_LONG[date.getDay()] ?? '';
}

/** Os 7 dias da semana corrente, segunda primeiro. */
export function currentWeek(reference: Date = new Date()): Date[] {
  const monday = startOfWeek(reference);
  return Array.from({ length: 7 }, (_, index) => addDays(monday, index));
}

export function isSameDay(a: Date, b: Date): boolean {
  return toIsoDate(a) === toIsoDate(b);
}

export function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

/** Data/hora a partir de um dia da semana corrente + hora cheia local. */
export function atTime(day: Date, hours: number, minutes = 0): Date {
  const d = new Date(day);
  d.setHours(hours, minutes, 0, 0);
  return d;
}
