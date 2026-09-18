import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useFlash } from './useFlash';

describe('useFlash', () => {
  it('на первой отрисовке не подсвечивает — иначе мигало бы всё при загрузке', () => {
    const { result } = renderHook(() => useFlash(10));

    expect(result.current).toBeNull();
  });

  it('подсвечивает при изменении значения', () => {
    const { result, rerender } = renderHook(({ value }) => useFlash(value), {
      initialProps: { value: 10 },
    });

    rerender({ value: 11 });

    expect(result.current).toBe('a');
  });

  it('чередует фазы, чтобы анимация перезапускалась подряд', () => {
    const { result, rerender } = renderHook(({ value }) => useFlash(value), {
      initialProps: { value: 10 },
    });

    rerender({ value: 11 });
    expect(result.current).toBe('a');

    rerender({ value: 12 });
    expect(result.current).toBe('b');

    rerender({ value: 13 });
    expect(result.current).toBe('a');
  });

  it('перерисовка с тем же значением фазу не меняет', () => {
    const { result, rerender } = renderHook(({ value }) => useFlash(value), {
      initialProps: { value: 10 },
    });

    rerender({ value: 11 });
    const after = result.current;

    rerender({ value: 11 });
    rerender({ value: 11 });

    expect(result.current).toBe(after);
  });

  it('работает со строками и null', () => {
    const { result, rerender } = renderHook(({ value }) => useFlash(value), {
      initialProps: { value: null as string | null },
    });

    rerender({ value: '82%' });
    expect(result.current).toBe('a');

    rerender({ value: null });
    expect(result.current).toBe('b');
  });
});
