import type { ReactNode } from 'react';
import styled from 'styled-components';

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.spacing.sm};
  height: 100%;
  padding: ${({ theme }) => theme.spacing.xxl};
  text-align: center;
  color: ${({ theme }) => theme.colors.textMuted};
`;

const Title = styled.p`
  font-size: ${({ theme }) => theme.font.size.lg};
  font-weight: ${({ theme }) => theme.font.weight.semibold};
  color: ${({ theme }) => theme.colors.text};
`;

const Description = styled.p`
  max-width: 48ch;
  font-size: ${({ theme }) => theme.font.size.md};
`;

const Actions = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.sm};
  margin-top: ${({ theme }) => theme.spacing.xs};
`;

export interface StateMessageProps {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  /** `status` — для фоновых сообщений, `alert` — для ошибок, требующих внимания. */
  role?: 'status' | 'alert';
}

export function StateMessage({
  icon,
  title,
  description,
  action,
  role = 'status',
}: StateMessageProps) {
  return (
    <Wrapper role={role}>
      {icon}
      <Title>{title}</Title>
      {description ? <Description>{description}</Description> : null}
      {action ? <Actions>{action}</Actions> : null}
    </Wrapper>
  );
}
