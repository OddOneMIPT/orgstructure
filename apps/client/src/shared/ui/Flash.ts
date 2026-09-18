import styled, { css, keyframes } from 'styled-components';

import { motion } from '@/shared/config/theme';

/**
 * Две анимации с одинаковым видимым эффектом: чередование `data-flash` между `a` и `b`
 * перезапускает подсветку без размонтирования элемента.
 *
 * Тело второй записано через `0%`/`100%` вместо `from`/`to` **намеренно**.
 * styled-components хэширует текст правила, и два побайтово одинаковых `keyframes`
 * схлопываются в одно имя. Тогда смена `data-flash` меняет правило, но не
 * `animation-name`: браузер считает анимацию той же самой и не перезапускает её,
 * поэтому подсветка срабатывала ровно один раз на ячейку, а дальше числа менялись
 * молча. Разные имена проверяются тестом — иначе дефект снова станет невидимым.
 */
const flashA = keyframes`
  from { background-color: var(--flash-color); }
  to { background-color: transparent; }
`;

const flashB = keyframes`
  0% { background-color: var(--flash-color); }
  100% { background-color: transparent; }
`;

/** Для теста: имена обязаны отличаться, иначе перезапуск анимации не работает. */
export const FLASH_ANIMATIONS = [flashA, flashB] as const;

const fade = (name: typeof flashA) => css`
  animation: ${name} ${({ theme }) => theme.timing.flash} ${({ theme }) => theme.easing};
`;

/**
 * Обёртка подсвечиваемого значения. Под `prefers-reduced-motion` подсветки нет вовсе:
 * анимация — её единственный носитель (ADR 005).
 */
export const Flash = styled.span`
  --flash-color: ${({ theme }) => theme.colors.flash};

  display: inline-block;
  border-radius: ${({ theme }) => theme.radii.sm};

  ${motion`
    &[data-flash='a'] {
      ${fade(flashA)}
    }

    &[data-flash='b'] {
      ${fade(flashB)}
    }
  `}
`;
