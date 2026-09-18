import { useEffect, useState } from 'react';

/**
 * Отложенное значение для фильтрации. Само поле ввода остаётся управляемым мгновенным
 * значением — иначе ввод «залипал» бы на время задержки.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    if (Object.is(value, debounced)) return undefined;

    const timer = setTimeout(() => {
      setDebounced(value);
    }, delayMs);

    return () => {
      clearTimeout(timer);
    };
  }, [value, debounced, delayMs]);

  return debounced;
}
