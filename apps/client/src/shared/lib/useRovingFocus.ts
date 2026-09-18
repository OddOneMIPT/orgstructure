import { useCallback, useEffect, useState, type KeyboardEvent, type RefObject } from 'react';

export interface RovingFocusOptions {
  /** Идентификаторы в том порядке, в каком они видны на экране. */
  ids: readonly string[];
  containerRef: RefObject<HTMLElement | null>;
  /** Enter по активному элементу. */
  onActivate?: (id: string) => void;
  /** Escape в списке: снимает выделение. Фокус при этом уходит со строки. */
  onEscape?: () => void;
  /** Дополнительные клавиши (например, стрелки вбок в дереве). Вернуть true, если обработано. */
  onKey?: (id: string, event: KeyboardEvent<HTMLElement>) => boolean;
  /**
   * Список берёт на себя стрелки, когда фокуса нет ни на чём: пользователь просто
   * нажимает вниз, и навигация начинает работать без предварительного Tab.
   * Владелец должен быть один — иначе две панели подрались бы за первое нажатие.
   */
  claimArrows?: boolean;
}

export interface RovingFocus {
  activeId: string | null;
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  /** Пропсы для элемента списка. */
  itemProps: (id: string) => {
    tabIndex: number;
    'data-roving-id': string;
    onFocus: () => void;
  };
  setActiveId: (id: string) => void;
}

/**
 * Roving tabindex: в списке ровно один элемент в порядке табуляции, остальные достижимы
 * стрелками. Общий для таблицы и дерева — механика одна и та же.
 *
 * Активный элемент хранится по `id`, а не по индексу: сортировка, фильтр и живой патч
 * меняют порядок строк, и индекс после них указывал бы на другую строку.
 */
export function useRovingFocus({
  ids,
  containerRef,
  onActivate,
  onEscape,
  onKey,
  claimArrows = false,
}: RovingFocusOptions): RovingFocus {
  const [activeId, setActiveId] = useState<string | null>(null);

  const current = activeId !== null && ids.includes(activeId) ? activeId : (ids[0] ?? null);

  /**
   * Фокус ставится сразу, а не в эффекте по смене состояния: если новое значение совпало
   * с прежним (например, фокус пришёл мышью и состояние отстало), React не перерисует
   * компонент, эффект не выполнится — и фокус останется на месте. Поймано тестом.
   */
  const move = useCallback(
    (next: string | undefined) => {
      if (next === undefined) return;

      setActiveId(next);

      const element = containerRef.current?.querySelector<HTMLElement>(
        `[data-roving-id="${CSS.escape(next)}"]`,
      );
      element?.focus();
      element?.scrollIntoView({ block: 'nearest' });
    },
    [containerRef],
  );

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if (ids.length === 0) return;
      if (event.altKey || event.ctrlKey || event.metaKey) return;

      /**
       * Текущий элемент берём из самого события, а не из состояния: фокус мог прийти
       * мышью или табом, и состояние на момент нажатия ещё не успело обновиться.
       * Событие же всегда рождается ровно на том элементе, который сейчас в фокусе.
       */
      const target = event.target instanceof HTMLElement ? event.target : null;
      const origin = target?.closest<HTMLElement>('[data-roving-id]');
      const focused = origin?.dataset.rovingId;
      const active = focused !== undefined && ids.includes(focused) ? focused : current;

      if (active === null) return;

      if (onKey?.(active, event)) {
        event.preventDefault();
        return;
      }

      const index = ids.indexOf(active);

      switch (event.key) {
        case 'ArrowDown':
          move(ids[Math.min(ids.length - 1, index + 1)]);
          break;
        case 'ArrowUp':
          move(ids[Math.max(0, index - 1)]);
          break;
        case 'Home':
          move(ids[0]);
          break;
        case 'End':
          move(ids[ids.length - 1]);
          break;
        case 'PageDown':
          move(ids[Math.min(ids.length - 1, index + 10)]);
          break;
        case 'PageUp':
          move(ids[Math.max(0, index - 10)]);
          break;
        case 'Enter':
        case ' ':
          onActivate?.(active);
          break;
        case 'Escape':
          onEscape?.();
          /**
           * Снимаем и обводку фокуса: после Escape список должен выглядеть «отпущенным».
           * Фокус уходит на body, откуда стрелки снова входят в список без Tab.
           */
          origin?.blur();
          break;
        default:
          return;
      }

      event.preventDefault();
    },
    [current, ids, move, onActivate, onEscape, onKey],
  );

  useEffect(() => {
    if (!claimArrows || current === null) return undefined;

    const onWindowKeyDown = (event: globalThis.KeyboardEvent): void => {
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;

      // Фокус уже где-то есть (поле поиска, кнопка, сам список) — не вмешиваемся.
      const active = document.activeElement;
      if (active !== null && active !== document.body) return;

      event.preventDefault();
      move(current);
    };

    window.addEventListener('keydown', onWindowKeyDown);
    return () => {
      window.removeEventListener('keydown', onWindowKeyDown);
    };
  }, [claimArrows, current, move]);

  const itemProps = useCallback(
    (id: string) => ({
      tabIndex: id === current ? 0 : -1,
      'data-roving-id': id,
      /**
       * Фокус мог прийти мышью или табом, минуя стрелки. Без этой синхронизации
       * стрелки продолжали бы двигаться от прежнего элемента — поймано тестом.
       */
      onFocus: () => {
        setActiveId(id);
      },
    }),
    [current],
  );

  return { activeId: current, onKeyDown, itemProps, setActiveId };
}
