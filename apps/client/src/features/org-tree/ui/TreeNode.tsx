import { ChevronRight } from 'lucide-react';
import { memo, useContext } from 'react';
import styled from 'styled-components';

import { performanceTone, splitByMatch, type OrgNodeId } from '@/entities/org';
import { motion } from '@/shared/config/theme';
import { describeStaff, formatBudget, formatStaff } from '@/shared/lib/format';
import { selectNode, useIsSelected } from '@/shared/model/dashboardStore';
import { FlashValue, PerformanceBar } from '@/shared/ui';

import { toggleNode, useIsExpanded } from '../model/treeUiStore';
import { OrgTreeContext } from './OrgTreeContext';

/** Глубже восьмого уровня отступ перестаёт расти: набор классов должен быть конечным (ADR 005). */
const MAX_INDENT_DEPTH = 8;

const Row = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) 92px 72px;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => `${theme.spacing.xs} ${theme.spacing.sm}`};
  border-radius: ${({ theme }) => theme.radii.sm};

  &:hover {
    background: ${({ theme }) => theme.colors.surfaceMuted};
  }

  /* Ветку раскрывает клик по всей строке — в шеврон целиться не нужно. */
  &[data-branch='true'] {
    cursor: pointer;
  }

  &[data-selected='true'] {
    background: ${({ theme }) => theme.colors.accentSoft};
  }

  mark {
    padding: 0 1px;
    border-radius: 2px;
    background: ${({ theme }) => theme.colors.flash};
    color: inherit;
  }
`;

/**
 * Отступ уровня — на ячейке имени, а не на вложенном `ul`: иначе вместе с именем
 * уезжали бы и колонки «Эффективность» и «Штат», а в макете они выровнены по вертикали.
 */
const NameCell = styled.div<{ $depth: number }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xxs};
  min-width: 0;
  padding-inline-start: ${({ theme, $depth }) => `${theme.treeIndent * $depth}px`};
`;

const Toggle = styled.button.attrs({ type: 'button' })`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 20px;
  height: 20px;
  padding: 0;
  border: 0;
  border-radius: ${({ theme }) => theme.radii.sm};
  background: transparent;
  color: ${({ theme }) => theme.colors.textMuted};
  cursor: pointer;

  &:hover {
    background: ${({ theme }) => theme.colors.border};
  }

  svg {
    ${motion`
      transition: transform ${({ theme }) => theme.timing.fast} ${({ theme }) => theme.easing};
    `}
  }

  &[aria-expanded='true'] svg {
    transform: rotate(90deg);
  }
`;

/** Лист выравнивается по узлам с шевроном. */
const ToggleSpacer = styled.span`
  flex: none;
  width: 20px;
`;

const Name = styled.span`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const Staff = styled.span`
  text-align: right;
  font-variant-numeric: tabular-nums;
  color: ${({ theme }) => theme.colors.textMuted};
`;

/**
 * Вложенная группа без собственного отступа: сдвигает только ячейка имени.
 * `display: contents` здесь не используется — он способен выкинуть роль из дерева доступности.
 */
const Group = styled.ul`
  margin: 0;
  padding: 0;
`;

export interface TreeNodeProps {
  id: OrgNodeId;
  depth: number;
  /** Пропсы roving tabindex: в дереве в порядке табуляции ровно один узел. */
  rovingProps: (id: OrgNodeId) => { tabIndex: number; 'data-roving-id': string };
}

/**
 * Пропсы — примитивы, а состояние раскрытия и выделения узел читает сам через селекторы,
 * поэтому `memo` действительно работает: раскрытие одной ветки не перерисовывает всё дерево.
 */
export const TreeNode = memo(function TreeNode({ id, depth, rovingProps }: TreeNodeProps) {
  const { model, view, query } = useContext(OrgTreeContext);
  const storeExpanded = useIsExpanded(id);
  const isSelected = useIsSelected(id);

  const node = model.byId.get(id);
  const aggregate = model.aggregates.get(id);
  if (!node || !aggregate) return null;

  const allChildren = model.childrenOf.get(id) ?? [];
  const children = view.isActive
    ? allChildren.filter((childId) => view.visible.has(childId))
    : allChildren;
  const hasChildren = children.length > 0;

  /**
   * Пока фильтр активен, раскрытие вычисляется: видно ровно пути до совпадений.
   * Набор пользователя при этом не трогаем — после сброса фильтра дерево вернётся
   * в прежний вид.
   */
  const isExpanded = view.isActive ? hasChildren : storeExpanded;

  return (
    <li
      role="treeitem"
      aria-level={depth + 1}
      aria-selected={isSelected}
      data-node-id={id}
      {...rovingProps(id)}
      {...(hasChildren ? { 'aria-expanded': isExpanded } : {})}
    >
      <Row
        data-branch={hasChildren && !view.isActive}
        data-selected={isSelected}
        onClick={() => {
          selectNode(id);
          if (hasChildren && !view.isActive) toggleNode(id);
        }}
      >
        <NameCell $depth={Math.min(depth, MAX_INDENT_DEPTH)}>
          {hasChildren && !view.isActive ? (
            <Toggle
              aria-expanded={isExpanded}
              aria-label={`${isExpanded ? 'Свернуть' : 'Развернуть'} ${node.name}`}
              onClick={(event) => {
                // Клик по строке уже переключает ветку — иначе она схлопнулась бы дважды.
                event.stopPropagation();
                toggleNode(id);
              }}
            >
              <ChevronRight size={14} aria-hidden />
            </Toggle>
          ) : (
            <ToggleSpacer />
          )}
          <Name title={node.name}>
            {splitByMatch(node.name, view.isActive ? query : '').map((part, index) =>
              part.matched ? (
                <mark key={index}>{part.text}</mark>
              ) : (
                <span key={index}>{part.text}</span>
              ),
            )}
          </Name>
        </NameCell>

        <FlashValue value={node.performance}>
          <PerformanceBar
            value={node.performance}
            tone={performanceTone(node.performance)}
            title={`Бюджет подразделения: ${formatBudget(node.budget)}\nОбновлено: ${new Date(
              node.updatedAt,
            ).toLocaleString('ru-RU')}`}
          />
        </FlashValue>

        <Staff title={describeStaff(node.headcount, aggregate.headcount)}>
          <FlashValue value={aggregate.headcount}>
            {formatStaff(node.headcount, aggregate.headcount)}
          </FlashValue>
        </Staff>
      </Row>

      {hasChildren && isExpanded ? (
        <Group role="group">
          {children.map((childId) => (
            <TreeNode key={childId} id={childId} depth={depth + 1} rovingProps={rovingProps} />
          ))}
        </Group>
      ) : null}
    </li>
  );
});
