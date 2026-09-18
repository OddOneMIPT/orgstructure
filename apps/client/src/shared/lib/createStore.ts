import { useSyncExternalStore } from 'react';

export interface Store<T> {
  getState: () => T;
  setState: (updater: (prev: T) => T) => void;
  subscribe: (listener: () => void) => () => void;
}

/**
 * Крошечный стор для UI-состояния (раскрытые ветки, выделение, режим панелей).
 *
 * Своё вместо Zustand — ради селекторов: каждый узел дерева подписывается только на
 * собственный `isOpen`, поэтому `memo` действительно спасает от перерисовки всего дерева
 * (CLAUDE.md). Серверные данные сюда не попадают — они живут в кэше react-query.
 */
export function createStore<T>(initial: T): Store<T> {
  let state = initial;
  const listeners = new Set<() => void>();

  return {
    getState: () => state,

    setState: (updater) => {
      const next = updater(state);
      // Ссылка не изменилась — значит, и подписчикам сообщать нечего.
      if (Object.is(next, state)) return;

      state = next;
      for (const listener of listeners) listener();
    },

    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/**
 * Селектор обязан возвращать примитив или стабильную ссылку: результат сравнивается
 * по Object.is, и новый объект на каждом вызове вызвал бы бесконечный ререндер.
 */
export function useStore<T, Selected>(store: Store<T>, selector: (state: T) => Selected): Selected {
  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.getState()),
    () => selector(store.getState()),
  );
}
