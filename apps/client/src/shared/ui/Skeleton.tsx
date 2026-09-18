import styled, { keyframes } from 'styled-components';

import { motion } from '@/shared/config/theme';

const shimmer = keyframes`
  0% { opacity: 0.55; }
  50% { opacity: 1; }
  100% { opacity: 0.55; }
`;

/** Ширину задают обёртки через собственные styled-правила, а не инлайн-стиль. */
export const Skeleton = styled.div.attrs({ 'aria-hidden': true })`
  height: 12px;
  border-radius: ${({ theme }) => theme.radii.sm};
  background: ${({ theme }) => theme.colors.border};

  ${motion`
    animation: ${shimmer} 1.4s ease-in-out infinite;
  `}
`;
