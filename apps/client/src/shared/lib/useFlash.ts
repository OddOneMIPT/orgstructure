import { useEffect, useRef, useState } from 'react';

/** Две одинаковые анимации под разными именами — чередование и есть перезапуск. */
export type FlashPhase = 'a' | 'b';

/**
 * Возвращает фазу подсветки, когда значение действительно изменилось.
 *
 * Почему не перезапуск анимации сменой `key`: изменение ключа **монтирует** элемент,
 * а маунт сам по себе запускает CSS-анимацию. Тогда подсветка вспыхивала бы при первой
 * загрузке, при переключении «Дерево/Таблица», при пересечении брейкпоинта и у строк,
 * вернувшихся после фильтра, — плюс размонтирование уносило бы фокус строки (ADR 005).
 *
 * Сравнивается именно значение, а не ссылка на объект: патч по одному узлу создаёт
 * новый агрегат у каждого предка, и «Бюджет суммарный» мигал бы с неизменившимся числом.
 */
export function useFlash(value: number | string | null): FlashPhase | null {
  const previous = useRef(value);
  const [phase, setPhase] = useState<FlashPhase | null>(null);

  useEffect(() => {
    if (Object.is(previous.current, value)) return;

    previous.current = value;
    setPhase((current) => (current === 'a' ? 'b' : 'a'));
  }, [value]);

  return phase;
}
