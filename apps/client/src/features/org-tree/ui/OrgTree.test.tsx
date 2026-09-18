import type { OrgNode } from '@org/contracts';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from 'styled-components';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ALL_VISIBLE, buildModel } from '@/entities/org';
import { theme } from '@/shared/config/theme';
import { dashboardStore, selectNode } from '@/shared/model/dashboardStore';

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

/** Та же структура, другие числа и ревизия — как после живого патча. */
const patchedModel = buildModel(
  [
    node('div', null, 'Технологии'),
    node('dep', 'div', 'Инфраструктура'),
    { ...node('team', 'dep', 'Облако'), headcount: 42 },
  ],
  { epoch: 'e1', version: 2 },
);

const rowOf = (name: string): HTMLElement => screen.getByText(name).closest('li')!;

/** Свёрнутая ветка остаётся в разметке ради анимации, поэтому смотрим на состояние, а не на наличие. */
const isOpen = (name: string): boolean => rowOf(name).getAttribute('aria-expanded') === 'true';

/** Узел внутри свёрнутой ветки скрыт от скринридера и недоступен для фокуса. */
const isHidden = (name: string): boolean => rowOf(name).closest('[aria-hidden="true"]') !== null;

beforeEach(() => {
  treeUiStore.setState(() => ({ expanded: new Set(), initializedFor: null }));
  dashboardStore.setState(() => ({
    keyboardPanel: 'table',
    query: '',
    selectedId: null,
    view: 'table',
  }));
});

describe('OrgTree', () => {
  it('по умолчанию показывает два уровня: дивизион и отдел', () => {
    renderTree();

    expect(isOpen('Технологии')).toBe(true);
    expect(isOpen('Инфраструктура')).toBe(false);
    expect(isHidden('Облако')).toBe(true);
  });

  it('раскрывает ветку кликом по строке, а не только по шеврону', async () => {
    const user = userEvent.setup();
    renderTree();

    await user.click(screen.getByText('Инфраструктура'));

    expect(isOpen('Инфраструктура')).toBe(true);
    expect(isHidden('Облако')).toBe(false);
  });

  it('повторный клик по строке не сворачивает ветку — клик не прячет данные', async () => {
    const user = userEvent.setup();
    renderTree();

    await user.click(screen.getByText('Инфраструктура'));
    await user.click(screen.getByText('Инфраструктура'));

    expect(isOpen('Инфраструктура')).toBe(true);
    expect(isHidden('Облако')).toBe(false);
  });

  it('клик по строке выделяет узел', async () => {
    const user = userEvent.setup();
    renderTree();

    await user.click(screen.getByText('Инфраструктура'));

    expect(dashboardStore.getState().selectedId).toBe('dep');
    expect(rowOf('Инфраструктура')).toHaveAttribute('aria-selected', 'true');
  });

  it('свернуть ветку можно шевроном', async () => {
    const user = userEvent.setup();
    renderTree();

    await user.click(screen.getByText('Инфраструктура'));
    const chevron = within(rowOf('Инфраструктура')).getByRole('button', {
      name: /свернуть инфраструктура/i,
    });
    await user.click(chevron);

    expect(isOpen('Инфраструктура')).toBe(false);
  });

  it('шеврон вне порядка табуляции: Tab не идёт через каждый узел', () => {
    renderTree();

    const chevrons = screen
      .getAllByRole('treeitem')
      .flatMap((item) => [...item.querySelectorAll(':scope > div button')]);

    expect(chevrons.length).toBeGreaterThan(0);
    for (const chevron of chevrons) {
      expect(chevron).toHaveAttribute('tabindex', '-1');
    }
  });

  it('клик по шеврону переключает ветку ровно один раз', async () => {
    const user = userEvent.setup();
    renderTree();

    const chevron = within(rowOf('Инфраструктура')).getByRole('button', {
      name: /развернуть инфраструктура/i,
    });
    await user.click(chevron);

    expect(isOpen('Инфраструктура')).toBe(true);
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
    expect(isOpen('Инфраструктура')).toBe(true);
    expect(isHidden('Облако')).toBe(false);

    await user.click(screen.getByRole('button', { name: 'Свернуть все' }));
    expect(isOpen('Технологии')).toBe(false);
    expect(isHidden('Инфраструктура')).toBe(true);
  });

  it('размечен как WAI-ARIA дерево с уровнями', () => {
    renderTree();

    expect(screen.getByRole('tree')).toBeInTheDocument();
    expect(rowOf('Технологии')).toHaveAttribute('aria-level', '1');
    expect(rowOf('Технологии')).toHaveAttribute('aria-expanded', 'true');
    expect(rowOf('Инфраструктура')).toHaveAttribute('aria-level', '2');
    expect(rowOf('Инфраструктура')).toHaveAttribute('aria-expanded', 'false');
  });

  describe('клавиатура', () => {
    it('в порядке табуляции ровно один узел', () => {
      renderTree();

      const items = screen.getAllByRole('treeitem');
      expect(items.filter((item) => item.getAttribute('tabindex') === '0')).toHaveLength(1);
    });

    it('стрелка вправо раскрывает ветку, влево — сворачивает', async () => {
      const user = userEvent.setup();
      renderTree();

      rowOf('Инфраструктура').focus();
      await user.keyboard('{ArrowRight}');
      expect(isOpen('Инфраструктура')).toBe(true);

      await user.keyboard('{ArrowLeft}');
      expect(isOpen('Инфраструктура')).toBe(false);
    });

    it('стрелка влево на свёрнутом узле уводит к родителю', async () => {
      const user = userEvent.setup();
      renderTree();

      rowOf('Инфраструктура').focus();
      await user.keyboard('{ArrowLeft}');

      expect(rowOf('Технологии')).toHaveAttribute('tabindex', '0');
    });

    it('стрелки вниз и вверх идут по видимым узлам', async () => {
      const user = userEvent.setup();
      renderTree();

      rowOf('Технологии').focus();
      await user.keyboard('{ArrowDown}');
      expect(rowOf('Инфраструктура')).toHaveFocus();

      await user.keyboard('{ArrowUp}');
      expect(rowOf('Технологии')).toHaveFocus();
    });

    it('Enter выделяет узел', async () => {
      const user = userEvent.setup();
      renderTree();

      rowOf('Инфраструктура').focus();
      await user.keyboard('{Enter}');

      expect(dashboardStore.getState().selectedId).toBe('dep');
    });
  });

  it('свёрнутая ветка помечена inert — её узлы не ловят фокус', () => {
    renderTree();

    const group = rowOf('Облако').closest('ul[role="group"]');
    expect(group).toHaveAttribute('inert');
  });

  it('раскрытая ветка снимает inert и aria-hidden', async () => {
    const user = userEvent.setup();
    renderTree();

    await user.click(screen.getByText('Инфраструктура'));

    const group = rowOf('Облако').closest('ul[role="group"]');
    expect(group).not.toHaveAttribute('inert');
    expect(isHidden('Облако')).toBe(false);
  });

  it('живое обновление не прокручивает дерево: скролл только при смене выделения', async () => {
    const scrollIntoView = vi.fn();
    const { rerender } = renderTree();

    act(() => {
      selectNode('dep');
    });

    await act(async () => {
      await new Promise((resolve) => {
        requestAnimationFrame(() => {
          resolve(undefined);
        });
      });
    });

    for (const item of screen.getAllByRole('treeitem')) {
      item.scrollIntoView = scrollIntoView;
    }
    scrollIntoView.mockClear();

    rerender(
      <ThemeProvider theme={theme}>
        <OrgTree model={patchedModel} view={ALL_VISIBLE} />
      </ThemeProvider>,
    );

    await act(async () => {
      await new Promise((resolve) => {
        requestAnimationFrame(() => {
          resolve(undefined);
        });
      });
    });

    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  describe('выделение', () => {
    it('повторный клик по выделенной строке снимает выделение', async () => {
      const user = userEvent.setup();
      renderTree();

      await user.click(screen.getByText('Инфраструктура'));
      expect(dashboardStore.getState().selectedId).toBe('dep');

      await user.click(screen.getByText('Инфраструктура'));
      expect(dashboardStore.getState().selectedId).toBeNull();
    });

    it('снятие выделения не сворачивает ветку', async () => {
      const user = userEvent.setup();
      renderTree();

      await user.click(screen.getByText('Инфраструктура'));
      await user.click(screen.getByText('Инфраструктура'));

      expect(isOpen('Инфраструктура')).toBe(true);
    });

    it('Escape снимает выделение', async () => {
      const user = userEvent.setup();
      renderTree();

      await user.click(screen.getByText('Инфраструктура'));
      rowOf('Инфраструктура').focus();
      await user.keyboard('{Escape}');

      expect(dashboardStore.getState().selectedId).toBeNull();
    });

    it('Enter тоже переключает выделение', async () => {
      const user = userEvent.setup();
      renderTree();

      rowOf('Инфраструктура').focus();
      await user.keyboard('{Enter}');
      expect(dashboardStore.getState().selectedId).toBe('dep');

      await user.keyboard('{Enter}');
      expect(dashboardStore.getState().selectedId).toBeNull();
    });
  });
});
