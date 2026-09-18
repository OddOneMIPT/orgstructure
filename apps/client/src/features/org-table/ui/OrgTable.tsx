import { ListRestart, SearchX } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';
import styled from 'styled-components';

import { performanceTone, splitByMatch, type FilteredView, type OrgModel } from '@/entities/org';
import { describeStaff, formatBudget, formatStaff, levelLabel } from '@/shared/lib/format';
import { selectNode, useQuery, useSelectedId } from '@/shared/model/dashboardStore';
import { Button, Panel, PerformanceBar, StateMessage } from '@/shared/ui';

import { selectRows } from '../model/selectRows';
import { resetSort, useSort } from '../model/tableUiStore';
import { TableHeaderCell } from './TableHeaderCell';

/** Глубже отступ не растёт — набор классов должен быть конечным (ADR 005). */
const MAX_INDENT_DEPTH = 8;

const TablePanel = styled(Panel)`
  grid-template-rows: auto minmax(0, 1fr);
`;

const Header = styled.header`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => `${theme.spacing.md} ${theme.spacing.lg}`};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
`;

const Title = styled.h2`
  font-size: ${({ theme }) => theme.font.size.lg};
  font-weight: ${({ theme }) => theme.font.weight.semibold};
`;

const Scroll = styled.div`
  min-height: 0;
  overflow: auto;
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: ${({ theme }) => theme.font.size.md};

  td {
    padding: ${({ theme }) => `${theme.spacing.xs} ${theme.spacing.md}`};
    border-bottom: 1px solid ${({ theme }) => theme.colors.surfaceMuted};
    white-space: nowrap;
  }

  td[data-align='right'] {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
`;

const Row = styled.tr`
  cursor: pointer;
  /* Чтобы прокрутка не прятала строку под липкой шапкой. */
  scroll-margin-block-start: 34px;

  &:hover {
    background: ${({ theme }) => theme.colors.surfaceMuted};
  }

  &[aria-selected='true'] {
    background: ${({ theme }) => theme.colors.accentSoft};
  }
`;

/**
 * `&&` поднимает специфичность: иначе общее правило `td` из Table перебивает отступ,
 * и уровни в колонке «Подразделение» перестают читаться.
 */
const NameCell = styled.td<{ $depth: number }>`
  && {
    max-width: 0;
    width: 40%;
    overflow: hidden;
    text-overflow: ellipsis;
    padding-inline-start: ${({ theme, $depth }) =>
      `calc(${theme.spacing.md} + ${theme.treeIndent * $depth}px)`};
  }

  mark {
    padding: 0 1px;
    border-radius: 2px;
    background: ${({ theme }) => theme.colors.flash};
    color: inherit;
  }
`;

const Level = styled.td`
  color: ${({ theme }) => theme.colors.textMuted};
`;

const PerformanceCell = styled.td`
  width: 140px;
`;

export interface OrgTableProps {
  model: OrgModel;
  view: FilteredView;
}

export function OrgTable({ model, view }: OrgTableProps) {
  const sort = useSort();
  const query = useQuery();
  const selectedId = useSelectedId();

  // Пересчёт только при смене модели, фильтра или сортировки.
  const rows = useMemo(() => selectRows(model, { view, sort }), [model, view, sort]);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Выделение приходит и из дерева: показываем строку, не трогая скролл, если она уже видна.
  useEffect(() => {
    if (selectedId === null) return undefined;

    // Следующим кадром: после смены сортировки или фильтра строка ещё не на своём месте.
    const frame = requestAnimationFrame(() => {
      scrollRef.current
        ?.querySelector(`[data-node-id="${CSS.escape(selectedId)}"]`)
        ?.scrollIntoView({ block: 'nearest' });
    });

    return () => {
      cancelAnimationFrame(frame);
    };
  }, [selectedId, rows]);

  return (
    <TablePanel aria-label="Аналитическая таблица">
      <Header>
        <Title>Подразделения</Title>
        {sort ? (
          <Button $variant="ghost" onClick={resetSort}>
            <ListRestart size={14} aria-hidden />
            Как в дереве
          </Button>
        ) : null}
      </Header>

      <Scroll ref={scrollRef}>
        {rows.length === 0 ? (
          <StateMessage
            icon={<SearchX size={24} aria-hidden />}
            title="Ничего не найдено"
            description="Ни одно подразделение не подходит под запрос."
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <TableHeaderCell column="name" label="Подразделение" sort={sort} />
                <TableHeaderCell column="level" label="Уровень" sort={sort} />
                <TableHeaderCell
                  column="headcount"
                  label="Всего сотрудников"
                  align="right"
                  sort={sort}
                />
                <TableHeaderCell
                  column="budget"
                  label="Бюджет суммарный"
                  align="right"
                  sort={sort}
                />
                <TableHeaderCell column="performance" label="Ср. эффективность" sort={sort} />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <Row
                  key={row.id}
                  data-node-id={row.id}
                  aria-selected={row.id === selectedId}
                  onClick={() => {
                    selectNode(row.id);
                  }}
                >
                  <NameCell $depth={sort ? 0 : Math.min(row.depth, MAX_INDENT_DEPTH)}>
                    {splitByMatch(row.name, view.isActive ? query : '').map((part, index) =>
                      part.matched ? (
                        <mark key={index}>{part.text}</mark>
                      ) : (
                        <span key={index}>{part.text}</span>
                      ),
                    )}
                  </NameCell>
                  <Level>{levelLabel(row.depth)}</Level>
                  <td
                    data-align="right"
                    title={describeStaff(row.ownHeadcount, row.aggregate.headcount)}
                  >
                    {formatStaff(row.ownHeadcount, row.aggregate.headcount)}
                  </td>
                  <td data-align="right">{formatBudget(row.aggregate.budget)}</td>
                  <PerformanceCell>
                    <PerformanceBar
                      value={row.aggregate.avgPerformance}
                      tone={performanceTone(row.aggregate.avgPerformance ?? 0)}
                    />
                  </PerformanceCell>
                </Row>
              ))}
            </tbody>
          </Table>
        )}
      </Scroll>
    </TablePanel>
  );
}
