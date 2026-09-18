import styled from 'styled-components';

import { setView, usePanelView, type PanelView } from '@/shared/model/dashboardStore';

const List = styled.div`
  display: inline-flex;
  padding: ${({ theme }) => theme.spacing.xxs};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.sm};
  background: ${({ theme }) => theme.colors.surfaceMuted};
`;

const Tab = styled.button.attrs({ type: 'button', role: 'tab' })`
  padding: ${({ theme }) => `${theme.spacing.xxs} ${theme.spacing.md}`};
  border: 0;
  border-radius: ${({ theme }) => theme.radii.sm};
  background: none;
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: ${({ theme }) => theme.font.size.md};
  cursor: pointer;

  &[aria-selected='true'] {
    background: ${({ theme }) => theme.colors.surface};
    color: ${({ theme }) => theme.colors.text};
    font-weight: ${({ theme }) => theme.font.weight.medium};
  }
`;

const TABS: { value: PanelView; label: string }[] = [
  { value: 'table', label: 'Таблица' },
  { value: 'tree', label: 'Дерево' },
];

/** Нужен только на узком экране: в split-view обе панели видны сразу. */
export function ViewSwitch() {
  const view = usePanelView();

  return (
    <List role="tablist" aria-label="Что показывать">
      {TABS.map((tab) => (
        <Tab
          key={tab.value}
          aria-selected={view === tab.value}
          onClick={() => {
            setView(tab.value);
          }}
        >
          {tab.label}
        </Tab>
      ))}
    </List>
  );
}
