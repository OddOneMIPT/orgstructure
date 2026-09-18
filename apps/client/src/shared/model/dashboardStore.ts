import { createStore, useStore } from '@/shared/lib/createStore';

export type PanelView = 'table' | 'tree';

export interface DashboardState {
  /** Панель, которой достаются стрелки, когда фокуса нет ни на чём. */
  keyboardPanel: PanelView;
  /** Мгновенное значение поля поиска; фильтрация идёт по отложенному. */
  query: string;
  /** Узел, выделенный в обоих представлениях сразу. */
  selectedId: string | null;
  /** Какая панель показана на узком экране. */
  view: PanelView;
}

/**
 * Состояние, общее для таблицы и дерева. Лежит в `shared`, а не в одной из фич:
 * фичи не имеют права импортировать друг друга, а это их общий язык.
 * Серверных данных здесь нет — они живут в кэше react-query.
 */
export const dashboardStore = createStore<DashboardState>({
  keyboardPanel: 'table',
  query: '',
  selectedId: null,
  view: 'table',
});

/** Вызывается при взаимодействии с панелью: дальше стрелки работают именно в ней. */
export function claimKeyboard(panel: PanelView): void {
  dashboardStore.setState((prev) =>
    prev.keyboardPanel === panel ? prev : { ...prev, keyboardPanel: panel },
  );
}

export function setQuery(query: string): void {
  dashboardStore.setState((prev) => (prev.query === query ? prev : { ...prev, query }));
}

export function selectNode(selectedId: string | null): void {
  dashboardStore.setState((prev) =>
    prev.selectedId === selectedId ? prev : { ...prev, selectedId },
  );
}

/** Повторный выбор того же узла снимает выделение. */
export function toggleNode(selectedId: string): void {
  dashboardStore.setState((prev) => ({
    ...prev,
    selectedId: prev.selectedId === selectedId ? null : selectedId,
  }));
}

export function setView(view: PanelView): void {
  dashboardStore.setState((prev) => (prev.view === view ? prev : { ...prev, view }));
}

export const useSearchQuery = (): string => useStore(dashboardStore, (state) => state.query);

export const useSelectedId = (): string | null =>
  useStore(dashboardStore, (state) => state.selectedId);

export const useIsSelected = (id: string): boolean =>
  useStore(dashboardStore, (state) => state.selectedId === id);

export const usePanelView = (): PanelView => useStore(dashboardStore, (state) => state.view);

export const useKeyboardPanel = (): PanelView =>
  useStore(dashboardStore, (state) => state.keyboardPanel);
