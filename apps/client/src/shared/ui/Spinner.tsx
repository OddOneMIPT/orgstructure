import { LoaderCircle } from 'lucide-react';
import styled, { keyframes } from 'styled-components';

import { motion } from '@/shared/config/theme';

const spin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

/**
 * Под prefers-reduced-motion иконка просто не вращается — она остаётся видимой,
 * а факт загрузки в любом случае дублируется текстом рядом.
 */
export const Spinner = styled(LoaderCircle).attrs({ 'aria-hidden': true })`
  flex: none;
  color: ${({ theme }) => theme.colors.textMuted};

  ${motion`
    animation: ${spin} 900ms linear infinite;
  `}
`;
