import { createStore, useStore } from '@/shared/lib/createStore';

import type { Sort, SortColumn } from './selectRows';

export interface TableUiState {
  /** `null` — порядок обхода дерева, как в макете. */
  sort: Sort | null;
}

export const tableUiStore = createStore<TableUiState>({ sort: null });

/**
 * Клик по заголовку сортирует по возрастанию, двойной — по убыванию (ADR 006).
 *
 * Двойной клик приходит как два обычных `click` плюс `dblclick`, поэтому «по возрастанию»
 * обязано быть идемпотентным: два клика подряд оставляют `asc`, и следующий за ними
 * `dblclick` спокойно переводит в `desc`. Никаких таймеров и гонок.
 */
export function sortAscending(column: SortColumn): void {
  tableUiStore.setState((prev) =>
    prev.sort?.column === column && prev.sort.direction === 'asc'
      ? prev
      : { sort: { column, direction: 'asc' } },
  );
}

export function sortDescending(column: SortColumn): void {
  tableUiStore.setState((prev) =>
    prev.sort?.column === column && prev.sort.direction === 'desc'
      ? prev
      : { sort: { column, direction: 'desc' } },
  );
}

/** Возврат к порядку дерева. */
export function resetSort(): void {
  tableUiStore.setState((prev) => (prev.sort === null ? prev : { sort: null }));
}

export const useSort = (): Sort | null => useStore(tableUiStore, (state) => state.sort);
