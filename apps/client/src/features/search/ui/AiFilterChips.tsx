import { Sparkles, X } from 'lucide-react';
import styled from 'styled-components';

import { describeFilter } from '@/entities/org';

import { setAiState, useAiSearch } from '../model/aiSearchStore';

const Bar = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.colors.textMuted};
`;

const Badge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xxs};
  color: ${({ theme }) => theme.colors.status.ok};
  font-weight: ${({ theme }) => theme.font.weight.medium};
`;

const Chip = styled.span`
  display: inline-flex;
  align-items: center;
  padding: ${({ theme }) => `${theme.spacing.xxs} ${theme.spacing.sm}`};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.pill};
  background: ${({ theme }) => theme.colors.surface};
  color: ${({ theme }) => theme.colors.text};
`;

const Reset = styled.button.attrs({ type: 'button' })`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xxs};
  padding: 0;
  border: 0;
  background: none;
  color: ${({ theme }) => theme.colors.textMuted};
  font: inherit;
  cursor: pointer;

  &:hover {
    color: ${({ theme }) => theme.colors.text};
  }
`;

const Note = styled.span`
  color: ${({ theme }) => theme.colors.textMuted};
`;

/**
 * Что именно поняла модель — видно текстом, а не на веру: применённые условия
 * показываются чипами, а неудачный разбор честно объясняет причину.
 */
export function AiFilterChips() {
  const ai = useAiSearch();

  if (ai.status === 'applied') {
    return (
      <Bar role="status">
        <Badge>
          <Sparkles size={14} aria-hidden />
          AI применён
        </Badge>
        {describeFilter(ai.filter).map((chip) => (
          <Chip key={chip}>{chip}</Chip>
        ))}
        <Reset
          onClick={() => {
            setAiState({ status: 'idle' });
          }}
        >
          <X size={13} aria-hidden />
          Сбросить
        </Reset>
      </Bar>
    );
  }

  if (ai.status === 'fallback') {
    return (
      <Bar role="status">
        <Note>Обычный поиск по названию: {ai.reason}</Note>
      </Bar>
    );
  }

  return null;
}
