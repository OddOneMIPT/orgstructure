import styled, { css } from 'styled-components';

type Variant = 'primary' | 'secondary' | 'ghost';

const variants = {
  primary: css`
    background: ${({ theme }) => theme.colors.accent};
    border-color: ${({ theme }) => theme.colors.accent};
    color: #ffffff;

    &:hover:not(:disabled) {
      filter: brightness(1.08);
    }
  `,
  secondary: css`
    background: ${({ theme }) => theme.colors.surface};
    border-color: ${({ theme }) => theme.colors.borderStrong};
    color: ${({ theme }) => theme.colors.text};

    &:hover:not(:disabled) {
      background: ${({ theme }) => theme.colors.surfaceMuted};
    }
  `,
  ghost: css`
    background: transparent;
    border-color: transparent;
    color: ${({ theme }) => theme.colors.textMuted};

    &:hover:not(:disabled) {
      background: ${({ theme }) => theme.colors.surfaceMuted};
      color: ${({ theme }) => theme.colors.text};
    }
  `,
} satisfies Record<Variant, ReturnType<typeof css>>;

export const Button = styled.button<{ $variant?: Variant }>`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
  padding: ${({ theme }) => `${theme.spacing.xs} ${theme.spacing.md}`};
  border: 1px solid;
  border-radius: ${({ theme }) => theme.radii.sm};
  font-size: ${({ theme }) => theme.font.size.md};
  font-weight: ${({ theme }) => theme.font.weight.medium};
  cursor: pointer;
  white-space: nowrap;

  ${({ $variant = 'secondary' }) => variants[$variant]}

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
`;
