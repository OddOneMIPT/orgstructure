import { SearchX } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';

import { useStore } from '@/shared/lib/createStore';
import styled from 'styled-components';

import { isVisible, type FilteredView, type OrgModel, type OrgNodeId } from '@/entities/org';
import { useRovingFocus } from '@/shared/lib/useRovingFocus';
import { selectNode, useQuery, useSelectedId } from '@/shared/model/dashboardStore';
import { Button, Panel, StateMessage } from '@/shared/ui';

import {
  collapseAll,
  expandAll,
  expandAncestors,
  initializeExpanded,
  treeUiStore,
  toggleNode,
  useExpandedCount,
} from '../model/treeUiStore';
import { OrgTreeContext } from './OrgTreeContext';
import { TreeNode } from './TreeNode';

const TreePanel = styled(Panel)`
  grid-template-rows: auto auto minmax(0, 1fr);
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

const Actions = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.xs};
`;

/** Шапка колонок — как в макете: Подразделение · Эффективность · Штат. */
const Columns = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) 92px 72px;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => `${theme.spacing.xs} ${theme.spacing.lg}`};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.surfaceMuted};
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: ${({ theme }) => theme.font.size.xs};
  text-transform: uppercase;
  letter-spacing: 0.04em;

  span:last-child {
    text-align: right;
  }
`;

/** Скроллится панель, а не страница. */
const Scroll = styled.div`
  min-height: 0;
  overflow: auto;
  padding: ${({ theme }) => theme.spacing.sm};
`;

const Root = styled.ul`
  margin: 0;
  padding: 0;
`;

export interface OrgTreeProps {
  model: OrgModel;
  view: FilteredView;
}

/** Дети узла, которые сейчас на экране. */
function childrenVisibleIn(
  model: OrgModel,
  view: FilteredView,
  id: OrgNodeId,
): readonly OrgNodeId[] {
  const children = model.childrenOf.get(id) ?? [];
  return view.isActive ? children.filter((child) => view.visible.has(child)) : children;
}

/** Плоский список видимых узлов в порядке обхода — как их видит пользователь. */
function flattenVisible(
  model: OrgModel,
  view: FilteredView,
  expanded: ReadonlySet<OrgNodeId>,
): OrgNodeId[] {
  const result: OrgNodeId[] = [];

  const walk = (ids: readonly OrgNodeId[]): void => {
    for (const id of ids) {
      result.push(id);

      const children = childrenVisibleIn(model, view, id);
      const isOpen = view.isActive ? children.length > 0 : expanded.has(id);
      if (isOpen) walk(children);
    }
  };

  walk(model.roots.filter((id) => isVisible(view, id)));

  return result;
}

export function OrgTree({ model, view }: OrgTreeProps) {
  const expandedCount = useExpandedCount();
  const expandedIds = useStore(treeUiStore, (state) => state.expanded);
  const selectedId = useSelectedId();
  const query = useQuery();
  const scrollRef = useRef<HTMLDivElement>(null);

  const roots = useMemo(() => model.roots.filter((id) => isVisible(view, id)), [model.roots, view]);
  const context = useMemo(() => ({ model, view, query }), [model, view, query]);

  /**
   * Порядок обхода видимых узлов — он же порядок движения стрелками.
   * Пересобирается при раскрытии, фильтрации и смене модели.
   */
  const visibleIds = useMemo(
    () => flattenVisible(model, view, expandedIds),
    [model, view, expandedIds],
  );

  const roving = useRovingFocus({
    ids: visibleIds,
    containerRef: scrollRef,
    onActivate: selectNode,
    onKey: (id, event) => {
      const key = event.key;
      const children = childrenVisibleIn(model, view, id);
      const isOpen = view.isActive ? children.length > 0 : expandedIds.has(id);

      if (key === 'ArrowRight' && children.length > 0 && !isOpen) {
        toggleNode(id);
        return true;
      }

      if (key === 'ArrowLeft') {
        if (children.length > 0 && isOpen) {
          toggleNode(id);
          return true;
        }

        const parent = model.byId.get(id)?.parentId ?? null;
        if (parent !== null) {
          roving.setActiveId(parent);
          return true;
        }
      }

      return false;
    },
  });

  useEffect(() => {
    initializeExpanded(model);
  }, [model]);

  // Выделение приходит и из таблицы: раскрываем путь и показываем узел.
  useEffect(() => {
    if (selectedId === null) return undefined;

    expandAncestors(model, selectedId);

    // Следующим кадром: до этого только что раскрытая строка ещё не встала на место.
    const frame = requestAnimationFrame(() => {
      scrollRef.current
        ?.querySelector(`[data-node-id="${CSS.escape(selectedId)}"]`)
        ?.scrollIntoView({ block: 'nearest' });
    });

    return () => {
      cancelAnimationFrame(frame);
    };
  }, [selectedId, model]);

  return (
    <OrgTreeContext.Provider value={context}>
      <TreePanel aria-label="Дерево орг-структуры">
        <Header>
          <Title>Дерево орг-структуры</Title>
          <Actions>
            <Button $variant="ghost" onClick={collapseAll} disabled={expandedCount === 0}>
              Свернуть все
            </Button>
            <Button
              $variant="ghost"
              onClick={() => {
                expandAll(model);
              }}
            >
              Развернуть все
            </Button>
          </Actions>
        </Header>

        <Columns aria-hidden>
          <span>Подразделение</span>
          <span>Эффективность</span>
          <span>Штат</span>
        </Columns>

        <Scroll ref={scrollRef} onKeyDown={roving.onKeyDown}>
          {roots.length === 0 ? (
            <StateMessage
              icon={<SearchX size={24} aria-hidden />}
              title="Ничего не найдено"
              description="Ни одно подразделение не подходит под запрос."
            />
          ) : (
            <Root role="tree" aria-label="Орг-структура компании">
              {roots.map((id) => (
                <TreeNode key={id} id={id} depth={0} rovingProps={roving.itemProps} />
              ))}
            </Root>
          )}
        </Scroll>
      </TreePanel>
    </OrgTreeContext.Provider>
  );
}
