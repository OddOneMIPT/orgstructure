import type { OrgNode } from '@org/contracts';
import { describe, expect, it } from 'vitest';

import { ALL_VISIBLE, buildModel, createNamePredicate, selectFilteredView } from '@/entities/org';

import { selectRows, type Sort } from './selectRows';

const node = (
  id: string,
  parentId: string | null,
  name: string,
  headcount = 5,
  budget = 1_000_000,
  performance = 70,
): OrgNode => ({
  id,
  name,
  parentId,
  headcount,
  budget,
  performance,
  updatedAt: '2026-09-18T09:00:00.000Z',
});

/**
 * Технологии (дивизион)
 *   Инфраструктура (отдел)
 *     Облако (команда)
 *   Аналитика (отдел)
 * Коммерция (дивизион)
 */
const model = buildModel(
  [
    node('div-t', null, 'Технологии', 4, 9_000_000, 90),
    node('dep-i', 'div-t', 'Инфраструктура', 3, 7_000_000, 80),
    node('team-c', 'dep-i', 'Облако', 10, 2_000_000, 40),
    node('dep-a', 'div-t', 'Аналитика', 2, 4_000_000, 60),
    node('div-k', null, 'Коммерция', 8, 3_000_000, 50),
  ],
  { epoch: 'e1', version: 1 },
);

const ids = (sort: Sort | null = null, view = ALL_VISIBLE) =>
  selectRows(model, { view, sort }).map((row) => row.id);

describe('порядок по умолчанию', () => {
  it('повторяет обход дерева: корни по алфавиту, внутри — дети по алфавиту', () => {
    expect(ids()).toEqual(['div-k', 'div-t', 'dep-a', 'dep-i', 'team-c']);
  });

  it('несёт глубину для отступа', () => {
    const rows = selectRows(model, { view: ALL_VISIBLE, sort: null });

    expect(rows.find((row) => row.id === 'team-c')?.depth).toBe(2);
    expect(rows.find((row) => row.id === 'div-k')?.depth).toBe(0);
  });

  it('строка несёт и агрегат, и собственные показатели узла', () => {
    const row = selectRows(model, { view: ALL_VISIBLE, sort: null }).find((r) => r.id === 'dep-i');

    expect(row?.aggregate.headcount).toBe(13);
    expect(row?.ownHeadcount).toBe(3);
  });
});

describe('сортировка', () => {
  it('по названию', () => {
    expect(ids({ column: 'name', direction: 'asc' })[0]).toBe('dep-a');
    expect(ids({ column: 'name', direction: 'desc' })[0]).toBe('div-t');
  });

  it('по уровню, внутри уровня — по названию', () => {
    expect(ids({ column: 'level', direction: 'asc' })).toEqual([
      'div-k',
      'div-t',
      'dep-a',
      'dep-i',
      'team-c',
    ]);
  });

  it('по суммарной численности', () => {
    expect(ids({ column: 'headcount', direction: 'desc' })[0]).toBe('div-t');
    expect(ids({ column: 'headcount', direction: 'asc' })[0]).toBe('dep-a');
  });

  it('по суммарному бюджету', () => {
    expect(ids({ column: 'budget', direction: 'desc' })[0]).toBe('div-t');
  });

  it('по средней эффективности', () => {
    const rows = selectRows(model, {
      view: ALL_VISIBLE,
      sort: { column: 'performance', direction: 'desc' },
    });

    const values = rows.map((row) => row.aggregate.avgPerformance);
    expect(values).toEqual([...values].sort((a, b) => (b ?? 0) - (a ?? 0)));
  });

  it('узлы без данных по эффективности уходят в конец при любом направлении', () => {
    const withEmpty = buildModel([node('a', null, 'А', 10, 1, 80), node('b', null, 'Б', 0, 1, 0)], {
      epoch: 'e1',
      version: 1,
    });

    const asc = selectRows(withEmpty, {
      view: ALL_VISIBLE,
      sort: { column: 'performance', direction: 'asc' },
    });
    const desc = selectRows(withEmpty, {
      view: ALL_VISIBLE,
      sort: { column: 'performance', direction: 'desc' },
    });

    expect(asc.at(-1)?.id).toBe('b');
    expect(desc.at(-1)?.id).toBe('b');
  });

  it('не мутирует исходный порядок', () => {
    const before = ids();
    ids({ column: 'name', direction: 'desc' });

    expect(ids()).toEqual(before);
  });
});

describe('фильтр', () => {
  const view = selectFilteredView(model, createNamePredicate('облако'));

  it('оставляет совпадение и его предков', () => {
    expect(ids(null, view)).toEqual(['div-t', 'dep-i', 'team-c']);
  });

  it('помечает само совпадение, но не предков', () => {
    const rows = selectRows(model, { view, sort: null });

    expect(rows.find((row) => row.id === 'team-c')?.isMatched).toBe(true);
    expect(rows.find((row) => row.id === 'div-t')?.isMatched).toBe(false);
  });

  it('пустой результат даёт пустой список строк', () => {
    const nothing = selectFilteredView(model, createNamePredicate('такого нет'));

    expect(ids(null, nothing)).toEqual([]);
  });

  it('фильтр и сортировка работают вместе', () => {
    expect(ids({ column: 'name', direction: 'asc' }, view)).toEqual(['dep-i', 'team-c', 'div-t']);
  });
});
