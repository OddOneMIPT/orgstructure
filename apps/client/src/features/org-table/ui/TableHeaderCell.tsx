import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import styled from 'styled-components';

import type { Sort, SortColumn } from '../model/selectRows';
import { sortAscending, sortDescending } from '../model/tableUiStore';

const Cell = styled.th.attrs({ role: 'columnheader' })`
  position: sticky;
  top: 0;
  z-index: 1;
  padding: ${({ theme }) => `${theme.spacing.sm} ${theme.spacing.md}`};
  background: ${({ theme }) => theme.colors.surfaceMuted};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: ${({ theme }) => theme.font.size.xs};
  font-weight: ${({ theme }) => theme.font.weight.semibold};
  text-transform: uppercase;
  letter-spacing: 0.04em;
  white-space: nowrap;
  /* Двойной клик по заголовку иначе выделяет его текст. */
  user-select: none;

  &[data-align='right'] {
    text-align: right;
  }
`;

const Trigger = styled.button.attrs({ type: 'button' })`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  letter-spacing: inherit;
  text-transform: inherit;
  cursor: pointer;

  &:hover {
    color: ${({ theme }) => theme.colors.text};
  }

  th[data-align='right'] & {
    flex-direction: row-reverse;
  }

  svg {
    flex: none;
    opacity: 0.45;
  }

  &[data-sorted='true'] {
    color: ${({ theme }) => theme.colors.text};
  }

  &[data-sorted='true'] svg {
    opacity: 1;
  }
`;

export interface TableHeaderCellProps {
  column: SortColumn;
  label: string;
  align?: 'left' | 'right';
  sort: Sort | null;
}

export function TableHeaderCell({ column, label, align = 'left', sort }: TableHeaderCellProps) {
  const active = sort?.column === column ? sort.direction : null;
  const Icon = active === 'asc' ? ArrowUp : active === 'desc' ? ArrowDown : ArrowUpDown;

  return (
    <Cell
      scope="col"
      data-align={align}
      aria-sort={active === 'asc' ? 'ascending' : active === 'desc' ? 'descending' : 'none'}
    >
      <Trigger
        data-sorted={active !== null}
        title="Клик — по возрастанию, двойной клик — по убыванию"
        onClick={() => {
          sortAscending(column);
        }}
        onDoubleClick={() => {
          sortDescending(column);
        }}
        onKeyDown={(event) => {
          if (event.key !== 'Enter') return;
          event.preventDefault();
          if (event.shiftKey) sortDescending(column);
          else sortAscending(column);
        }}
      >
        {label}
        <Icon size={13} aria-hidden />
      </Trigger>
    </Cell>
  );
}
