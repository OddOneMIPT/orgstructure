export interface BackoffOptions {
  /** Задержка первой повторной попытки. */
  baseMs?: number;
  /** Потолок: дальше задержка не растёт. */
  capMs?: number;
  random?: () => number;
}

export const DEFAULT_BACKOFF = { baseMs: 1_000, capMs: 30_000 } as const;

/**
 * Экспоненциальный backoff с полным джиттером: `random(0, min(cap, base · 2^attempt))`.
 *
 * Джиттер важнее, чем кажется: без него все вкладки и все клиенты, отвалившиеся
 * одновременно, вернутся тоже одновременно и добьют поднимающийся сервер.
 *
 * @param attempt номер неудачной попытки, начиная с 0.
 */
export function nextDelay(attempt: number, options: BackoffOptions = {}): number {
  const {
    baseMs = DEFAULT_BACKOFF.baseMs,
    capMs = DEFAULT_BACKOFF.capMs,
    random = Math.random,
  } = options;

  const bounded = Math.min(capMs, baseMs * 2 ** Math.max(0, attempt));

  return Math.round(random() * bounded);
}
