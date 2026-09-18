import { useEffect } from 'react';
import styled from 'styled-components';

import type { OrgModel } from '@/entities/org';
import { Button, Panel } from '@/shared/ui';

import { collapseAll, expandAll, initializeExpanded, useExpandedCount } from '../model/treeUiStore';
import { OrgModelContext } from './OrgModelContext';
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
  grid-template-columns: minmax(0, 1fr) 92px 60px;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => `${theme.spacing.xs} ${theme.spacing.lg}`};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.surfaceMuted};
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: ${({ theme }) => theme.font.size.xs};
  text-transform: uppercase;
  letter-spacing: 0.04em;

  span:nth-child(2) {
    text-align: left;
  }

  span:last-child {
    text-align: right;
  }
`;

/** Скроллится панель, а не страница. */
const Scroll = styled.div`
  min-height: 0;
  overflow: auto;
  padding: ${({ theme }) => `${theme.spacing.sm} ${theme.spacing.sm}`};
`;

const Root = styled.ul`
  margin: 0;
  padding: 0;
`;

export interface OrgTreeProps {
  model: OrgModel;
}

export function OrgTree({ model }: OrgTreeProps) {
  const expandedCount = useExpandedCount();

  useEffect(() => {
    initializeExpanded(model);
  }, [model]);

  return (
    <OrgModelContext.Provider value={model}>
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

        <Scroll>
          <Root role="tree" aria-label="Орг-структура компании">
            {model.roots.map((id) => (
              <TreeNode key={id} id={id} depth={0} />
            ))}
          </Root>
        </Scroll>
      </TreePanel>
    </OrgModelContext.Provider>
  );
}
