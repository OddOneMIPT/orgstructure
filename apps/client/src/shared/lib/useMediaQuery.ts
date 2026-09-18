import { useSyncExternalStore } from 'react';

/**
 * Подписка на медиазапрос без ресайз-листенеров.
 * Тонкая обёртка ещё и затем, чтобы `matchMedia` (которого нет в jsdom) подменялся в одном месте.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window.matchMedia !== 'function') return () => undefined;

      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => {
        list.removeEventListener('change', onChange);
      };
    },
    () => (typeof window.matchMedia === 'function' ? window.matchMedia(query).matches : false),
    () => false,
  );
}
