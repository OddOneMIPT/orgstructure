import styled, { css, keyframes } from 'styled-components';

import { motion } from '@/shared/config/theme';

/**
 * Две идентичные анимации под разными именами: чередование `data-flash` между `a` и `b`
 * перезапускает подсветку без размонтирования элемента.
 */
const flashA = keyframes`
  from { background-color: var(--flash-color); }
  to { background-color: transparent; }
`;

const flashB = keyframes`
  from { background-color: var(--flash-color); }
  to { background-color: transparent; }
`;

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
