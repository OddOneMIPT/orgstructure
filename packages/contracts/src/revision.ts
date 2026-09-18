/**
 * Ревизия данных — пара `{ epoch, version }` (ADR 004).
 *
 * `version` монотонно растёт внутри одного запуска сервера, но состояние живёт в памяти:
 * после рестарта счётчик начинается заново и может совпасть со старым. Поэтому версии
 * сравнимы только внутри одной эпохи, а эпоха — идентификатор запуска процесса.
 */
export interface Revision {
  epoch: string;
  version: number;
}

/** Значение заголовка `ETag` для снимка. */
export function formatRevision(revision: Revision): string {
  return `"${revision.epoch}.${revision.version}"`;
}

/**
 * Разбор `ETag`. Терпит слабый префикс `W/`: nginx помечает ETag слабым,
 * когда сам сжимает проксируемый ответ, и до клиента доезжает `W/"..."`.
 *
 * `null` означает «ревизия неизвестна» — патчи в этом случае не применяются (ADR 002).
 */
export function parseRevision(etag: string | null | undefined): Revision | null {
  if (!etag) return null;

  const match = /^(?:W\/)?"(.+)\.(\d+)"$/.exec(etag.trim());
  if (!match) return null;

  const [, epoch, version] = match;
  if (!epoch || !version) return null;

  return { epoch, version: Number(version) };
}

/** Две ревизии сравнимы только внутри одной эпохи. */
export function isSameRevision(a: Revision | null, b: Revision | null): boolean {
  return a !== null && b !== null && a.epoch === b.epoch && a.version === b.version;
}
