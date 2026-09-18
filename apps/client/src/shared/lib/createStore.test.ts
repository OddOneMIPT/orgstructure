import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { createStore, useStore } from './createStore';

describe('createStore', () => {
  it('отдаёт текущее состояние', () => {
    expect(createStore({ count: 1 }).getState()).toEqual({ count: 1 });
  });

  it('уведомляет подписчиков об изменении', () => {
    const store = createStore({ count: 0 });
    const listener = vi.fn();
    store.subscribe(listener);

    store.setState((prev) => ({ count: prev.count + 1 }));

    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getState()).toEqual({ count: 1 });
  });

  it('молчит, если ссылка не изменилась', () => {
    const store = createStore({ count: 0 });
    const listener = vi.fn();
    store.subscribe(listener);

    store.setState((prev) => prev);

    expect(listener).not.toHaveBeenCalled();
  });

  it('отписка прекращает уведомления', () => {
    const store = createStore({ count: 0 });
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    unsubscribe();
    store.setState(() => ({ count: 5 }));

    expect(listener).not.toHaveBeenCalled();
  });
});

describe('useStore', () => {
  it('перерисовывает компонент, когда выбранное значение изменилось', () => {
    const store = createStore({ a: 1, b: 1 });
    const { result } = renderHook(() => useStore(store, (state) => state.a));

    expect(result.current).toBe(1);

    act(() => {
      store.setState((prev) => ({ ...prev, a: 2 }));
    });

    expect(result.current).toBe(2);
  });

  it('не перерисовывает, когда изменилось не выбранное поле', () => {
    const store = createStore({ a: 1, b: 1 });
    const renders = vi.fn();

    renderHook(() => {
      renders();
      return useStore(store, (state) => state.a);
    });

    const before = renders.mock.calls.length;

    act(() => {
      store.setState((prev) => ({ ...prev, b: 99 }));
    });

    expect(renders.mock.calls.length).toBe(before);
  });
});
