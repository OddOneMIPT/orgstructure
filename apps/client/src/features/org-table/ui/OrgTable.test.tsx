import type { OrgNode } from '@org/contracts';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from 'styled-components';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ALL_VISIBLE, buildModel, createNamePredicate, selectFilteredView } from '@/entities/org';
import { theme } from '@/shared/config/theme';
import { dashboardStore, selectNode, setQuery } from '@/shared/model/dashboardStore';
import { normalizeSpaces } from '@/shared/lib/format';

import { tableUiStore } from '../model/tableUiStore';
import { OrgTable } from './OrgTable';

const node = (
  id: string,
  parentId: string | null,
  name: string,
  headcount: number,
  budget: number,
  performance: number,
): OrgNode => ({
  id,
  name,
  parentId,
  headcount,
  budget,
  performance,
  updatedAt: '2026-09-18T09:00:00.000Z',
});

const model = buildModel(
  [
    node('div-t', null, 'Технологии', 4, 9_000_000, 90),
    node('dep-i', 'div-t', 'Инфраструктура', 3, 7_000_000, 80),
    node('team-c', 'dep-i', 'Облако', 10, 2_000_000, 40),
    node('div-k', null, 'Коммерция', 8, 3_000_000, 50),
  ],
  { epoch: 'e1', version: 1 },
);

const renderTable = (view = ALL_VISIBLE) =>
  render(
    <ThemeProvider theme={theme}>
      <OrgTable model={model} view={view} />
    </ThemeProvider>,
  );

const names = (): string[] =>
  screen
    .getAllByRole('row')
    .slice(1)
    .map((row) => row.querySelectorAll('td')[0]?.textContent ?? '');

const header = (label: string | RegExp) =>
  screen.getAllByRole('button').find((button) => {
    const text = button.textContent ?? '';
    return typeof label === 'string' ? text.includes(label) : label.test(text);
  })!;

beforeEach(() => {
  tableUiStore.setState(() => ({ sort: null }));
  dashboardStore.setState(() => ({ query: '', selectedId: null, view: 'table' }));
});

describe('OrgTable', () => {
  it('показывает все пять колонок задания', () => {
    renderTable();

    for (const label of [
      'Подразделение',
      'Уровень',
      'Всего сотрудников',
      'Бюджет суммарный',
      'Ср. эффективность',
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it('по умолчанию идёт в порядке дерева', () => {
    renderTable();

    expect(names()).toEqual(['Коммерция', 'Технологии', 'Инфраструктура', 'Облако']);
  });

  it('показывает суммарные показатели и бюджет в формате задания', () => {
    renderTable();
    const row = screen.getByText('Технологии').closest('tr')!;

    // 4 + 3 + 10 человек и 9 + 7 + 2 млн.
    expect(row.querySelectorAll('td')[2]?.textContent).toBe('17');
    expect(normalizeSpaces(row.textContent ?? '')).toContain('18 000 000 руб.');
  });

  it('клик по заголовку сортирует по возрастанию', async () => {
    const user = userEvent.setup();
    renderTable();

    await user.click(header('Бюджет суммарный'));

    expect(names()[0]).toBe('Облако');
  });

  it('двойной клик сортирует по убыванию', async () => {
    const user = userEvent.setup();
    renderTable();

    await user.dblClick(header('Бюджет суммарный'));

    expect(names()[0]).toBe('Технологии');
  });

  it('повторный одиночный клик оставляет возрастание — двойной клик не должен ломаться', async () => {
    const user = userEvent.setup();
    renderTable();

    const trigger = header('Всего сотрудников');
    await user.click(trigger);
    await user.click(trigger);

    expect(tableUiStore.getState().sort).toEqual({ column: 'headcount', direction: 'asc' });
  });

  it('проставляет aria-sort на активной колонке', async () => {
    const user = userEvent.setup();
    renderTable();

    await user.click(header('Уровень'));

    expect(screen.getByText('Уровень').closest('th')).toHaveAttribute('aria-sort', 'ascending');
  });

  it('кнопка возврата появляется только при активной сортировке и сбрасывает порядок', async () => {
    const user = userEvent.setup();
    renderTable();

    expect(screen.queryByRole('button', { name: /как в дереве/i })).not.toBeInTheDocument();

    await user.click(header('Подразделение'));
    await user.click(screen.getByRole('button', { name: /как в дереве/i }));

    expect(names()).toEqual(['Коммерция', 'Технологии', 'Инфраструктура', 'Облако']);
  });

  it('клик по строке выделяет узел', async () => {
    const user = userEvent.setup();
    renderTable();

    await user.click(screen.getByText('Облако'));

    expect(dashboardStore.getState().selectedId).toBe('team-c');
    expect(screen.getByText('Облако').closest('tr')).toHaveAttribute('aria-selected', 'true');
  });

  it('при фильтре показывает совпадения с предками и подсвечивает совпавший текст', () => {
    setQuery('обл');
    renderTable(selectFilteredView(model, createNamePredicate('обл')));

    expect(names()).toEqual(['Технологии', 'Инфраструктура', 'Облако']);

    const marks = document.querySelectorAll('mark');
    expect(marks).toHaveLength(1);
    expect(marks[0]?.textContent).toBe('Обл');
  });

  it('пустой результат показывает «ничего не найдено» вместо пустой таблицы', () => {
    renderTable(selectFilteredView(model, createNamePredicate('такого нет')));

    expect(screen.getByText(/ничего не найдено/i)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('прокручивает таблицу к узлу, выбранному в дереве', async () => {
    const scrollIntoView = vi.fn();
    renderTable();

    for (const row of screen.getAllByRole('row')) {
      row.scrollIntoView = scrollIntoView;
    }

    act(() => {
      selectNode('team-c');
    });

    // Прокрутка отложена на кадр: до этого строка может быть ещё не на месте.
    await act(async () => {
      await new Promise((resolve) => {
        requestAnimationFrame(() => {
          resolve(undefined);
        });
      });
    });

    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' });
  });
});
