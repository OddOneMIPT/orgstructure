import { ChevronRight } from 'lucide-react';
import { memo, useContext } from 'react';
import styled from 'styled-components';

import { performanceTone, type OrgNodeId } from '@/entities/org';
import { motion } from '@/shared/config/theme';
import { PerformanceBar } from '@/shared/ui';

import { toggleNode, useIsExpanded } from '../model/treeUiStore';
import { OrgModelContext } from './OrgModelContext';

/** Глубже восьмого уровня отступ перестаёт расти: набор классов должен быть конечным (ADR 005). */
const MAX_INDENT_DEPTH = 8;

const Row = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) 92px 60px;
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
}

/**
 * Пропсы — примитивы, а состояние раскрытия узел читает сам через селектор,
 * поэтому `memo` действительно работает: раскрытие одной ветки не перерисовывает всё дерево.
 */
export const TreeNode = memo(function TreeNode({ id, depth }: TreeNodeProps) {
  const model = useContext(OrgModelContext);
  const isExpanded = useIsExpanded(id);

  const node = model.byId.get(id);
  const children = model.childrenOf.get(id) ?? [];
  const hasChildren = children.length > 0;

  if (!node) return null;

  return (
    <li
      role="treeitem"
      aria-level={depth + 1}
      {...(hasChildren ? { 'aria-expanded': isExpanded } : {})}
    >
      <Row
        data-branch={hasChildren}
        onClick={
          hasChildren
            ? () => {
                toggleNode(id);
              }
            : undefined
        }
      >
        <NameCell $depth={Math.min(depth, MAX_INDENT_DEPTH)}>
          {hasChildren ? (
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
          <Name title={node.name}>{node.name}</Name>
        </NameCell>

        <PerformanceBar value={node.performance} tone={performanceTone(node.performance)} />

        <Staff>{node.headcount} чел</Staff>
      </Row>

      {hasChildren && isExpanded ? (
        <Group role="group">
          {children.map((childId) => (
            <TreeNode key={childId} id={childId} depth={depth + 1} />
          ))}
        </Group>
      ) : null}
    </li>
  );
});
