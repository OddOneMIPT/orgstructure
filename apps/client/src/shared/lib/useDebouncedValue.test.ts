import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useDebouncedValue } from './useDebouncedValue';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useDebouncedValue', () => {
  it('сразу отдаёт начальное значение', () => {
    const { result } = renderHook(() => useDebouncedValue('старт', 250));

    expect(result.current).toBe('старт');
  });

  it('отдаёт новое значение только после задержки', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 250), {
      initialProps: { value: 'а' },
    });

    rerender({ value: 'аб' });
    expect(result.current).toBe('а');

    act(() => {
      vi.advanceTimersByTime(249);
    });
    expect(result.current).toBe('а');

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe('аб');
  });

  it('быстрый ввод даёт одно обновление в конце, а не по одному на символ', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 250), {
      initialProps: { value: '' },
    });

    for (const value of ['о', 'об', 'обл', 'обла']) {
      rerender({ value });
      act(() => {
        vi.advanceTimersByTime(100);
      });
      expect(result.current).toBe('');
    }

    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(result.current).toBe('обла');
  });

  it('возврат к прежнему значению не порождает лишнего обновления', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 250), {
      initialProps: { value: 'а' },
    });

    rerender({ value: 'аб' });
    rerender({ value: 'а' });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current).toBe('а');
  });
});
