const budgetFormatter = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });
const percentFormatter = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });

/** Прочерк вместо значения, когда показателя нет. */
export const EMPTY_VALUE = '—';

/**
 * `12 345 678 руб.` — разделитель разрядов ставит Intl, и это неразрывный пробел
 * (в части версий ICU — U+202F). Поэтому сравнивать такие строки в тестах нужно
 * после нормализации пробелов, а не по глазам.
 */
export function formatBudget(value: number): string {
  return `${budgetFormatter.format(value)} руб.`;
}

export function formatPercent(value: number | null): string {
  return value === null ? EMPTY_VALUE : `${percentFormatter.format(Math.round(value))}%`;
}

export function formatCount(value: number): string {
  return budgetFormatter.format(value);
}

/**
 * Штат узла: собственный и суммарный по поддереву — «3 / 128».
 * У листа суммарный совпадает с собственным, и второе число только мешает.
 */
export function formatStaff(own: number, total: number): string {
  return own === total ? formatCount(own) : `${formatCount(own)} / ${formatCount(total)}`;
}

export function describeStaff(own: number, total: number): string {
  return own === total
    ? `${formatCount(own)} сотрудников`
    : `${formatCount(own)} сотрудников в самом подразделении, ${formatCount(total)} с учётом вложенных`;
}

const LEVEL_LABELS = ['дивизион', 'отдел', 'команда'] as const;

/**
 * Уровень вложенности словом. Глубже третьего уровня в макете случая нет —
 * «уровень N» это наше расширение, чтобы таблица не ломалась на нестандартных данных.
 */
export function levelLabel(depth: number): string {
  return LEVEL_LABELS[depth] ?? `уровень ${depth + 1}`;
}

/** Нормализует любые пробелы к обычному — для сравнения форматированных строк. */
export function normalizeSpaces(value: string): string {
  return value.replace(/[\s\u00a0\u202f]+/g, ' ');
}
