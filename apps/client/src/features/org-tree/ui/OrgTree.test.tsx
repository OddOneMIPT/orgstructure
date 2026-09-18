import type { OrgNode } from '@org/contracts';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from 'styled-components';
import { beforeEach, describe, expect, it } from 'vitest';

import { ALL_VISIBLE, buildModel } from '@/entities/org';
import { theme } from '@/shared/config/theme';
import { dashboardStore } from '@/shared/model/dashboardStore';

import { treeUiStore } from '../model/treeUiStore';
import { OrgTree } from './OrgTree';

const node = (id: string, parentId: string | null, name: string): OrgNode => ({
  id,
  name,
  parentId,
  headcount: 7,
  budget: 1_000_000,
  performance: 80,
  updatedAt: '2026-09-18T09:00:00.000Z',
});

const model = buildModel(
  [
    node('div', null, 'Технологии'),
    node('dep', 'div', 'Инфраструктура'),
    node('team', 'dep', 'Облако'),
  ],
  { epoch: 'e1', version: 1 },
);

const renderTree = () =>
  render(
    <ThemeProvider theme={theme}>
      <OrgTree model={model} view={ALL_VISIBLE} />
    </ThemeProvider>,
  );

const rowOf = (name: string): HTMLElement => screen.getByText(name).closest('li')!;

beforeEach(() => {
  treeUiStore.setState(() => ({ expanded: new Set(), initializedFor: null }));
  dashboardStore.setState(() => ({ query: '', selectedId: null, view: 'table' }));
});

describe('OrgTree', () => {
  it('по умолчанию показывает два уровня: дивизион и отдел', () => {
    renderTree();

    expect(screen.getByText('Технологии')).toBeInTheDocument();
    expect(screen.getByText('Инфраструктура')).toBeInTheDocument();
    expect(screen.queryByText('Облако')).not.toBeInTheDocument();
  });

  it('раскрывает ветку кликом по строке, а не только по шеврону', async () => {
    const user = userEvent.setup();
    renderTree();

    await user.click(screen.getByText('Инфраструктура'));

    expect(screen.getByText('Облако')).toBeInTheDocument();
  });

  it('повторный клик по строке сворачивает ветку', async () => {
    const user = userEvent.setup();
    renderTree();

    await user.click(screen.getByText('Инфраструктура'));
    await user.click(screen.getByText('Инфраструктура'));

    expect(screen.queryByText('Облако')).not.toBeInTheDocument();
  });

  it('клик по шеврону переключает ветку ровно один раз', async () => {
    const user = userEvent.setup();
    renderTree();

    const chevron = within(rowOf('Инфраструктура')).getByRole('button', {
      name: /развернуть инфраструктура/i,
    });
    await user.click(chevron);

    expect(screen.getByText('Облако')).toBeInTheDocument();
  });

  it('у листа нет кнопки раскрытия и aria-expanded', async () => {
    const user = userEvent.setup();
    renderTree();
    await user.click(screen.getByText('Инфраструктура'));

    const leaf = rowOf('Облако');
    expect(leaf).not.toHaveAttribute('aria-expanded');
    expect(within(leaf).queryByRole('button')).not.toBeInTheDocument();
  });

  it('«Развернуть все» открывает всё дерево, «Свернуть все» закрывает', async () => {
    const user = userEvent.setup();
    renderTree();

    await user.click(screen.getByRole('button', { name: 'Развернуть все' }));
    expect(screen.getByText('Облако')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Свернуть все' }));
    expect(screen.queryByText('Инфраструктура')).not.toBeInTheDocument();
  });

  it('размечен как WAI-ARIA дерево с уровнями', () => {
    renderTree();

    expect(screen.getByRole('tree')).toBeInTheDocument();
    expect(rowOf('Технологии')).toHaveAttribute('aria-level', '1');
    expect(rowOf('Технологии')).toHaveAttribute('aria-expanded', 'true');
    expect(rowOf('Инфраструктура')).toHaveAttribute('aria-level', '2');
    expect(rowOf('Инфраструктура')).toHaveAttribute('aria-expanded', 'false');
  });
});
