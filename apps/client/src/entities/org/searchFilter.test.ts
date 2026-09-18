import { describe, expect, it } from 'vitest';

import { EMPTY_FILTER, type OrgNode, type SearchFilter } from '@org/contracts';

import { buildModel } from './buildModel';
import { selectFilteredView } from './filter';
import { createFilterPredicate, describeFilter } from './searchFilter';

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

/**
 * Технологии (дивизион, суммарно 17 чел / 18 млн)
 *   Инфраструктура (отдел, 13 чел / 9 млн)
 *     Облако (команда, 10 чел / 2 млн)
 * Коммерция (дивизион, 8 чел / 3 млн)
 */
const model = buildModel(
  [
    node('div-t', null, 'Технологии', 4, 9_000_000, 90),
    node('dep-i', 'div-t', 'Инфраструктура', 3, 7_000_000, 80),
    node('team-c', 'dep-i', 'Облако', 10, 2_000_000, 40),
    node('div-k', null, 'Коммерция', 8, 3_000_000, 50),
  ],
  { epoch: 'e1', version: 1 },
);

const filter = (patch: Partial<SearchFilter>): SearchFilter => ({ ...EMPTY_FILTER, ...patch });

const matched = (patch: Partial<SearchFilter>): string[] =>
  [...selectFilteredView(model, createFilterPredicate(filter(patch))).matched].sort();

describe('createFilterPredicate', () => {
  it('фильтрует по уровню', () => {
    expect(matched({ levels: ['division'] })).toEqual(['div-k', 'div-t']);
    expect(matched({ levels: ['team'] })).toEqual(['team-c']);
  });

  it('сравнивает бюджет с агрегатом, а не с собственным значением узла', () => {
    // Собственный бюджет Инфраструктуры — 7 млн, суммарный — 9 млн.
    expect(matched({ budget: { min: 8_000_000, max: null } })).toEqual(['dep-i', 'div-t']);
  });

  it('сравнивает численность с агрегатом', () => {
    expect(matched({ headcount: { min: 15, max: null } })).toEqual(['div-t']);
  });

  it('фильтрует по средней эффективности', () => {
    // Взвешенные средние: team-c 40, dep-i 49.2, div-k 50, div-t 58.8.
    expect(matched({ performance: { min: null, max: 45 } })).toEqual(['team-c']);
    expect(matched({ performance: { min: 50, max: null } })).toEqual(['div-k', 'div-t']);
  });

  it('условия объединяются по И', () => {
    expect(matched({ levels: ['division'], headcount: { min: 15, max: null } })).toEqual(['div-t']);
  });

  it('границы диапазона включающие', () => {
    expect(matched({ headcount: { min: 17, max: 17 } })).toEqual(['div-t']);
  });

  it('фильтрует по названию', () => {
    expect(matched({ name: 'обл' })).toEqual(['team-c']);
  });

  it('пустой фильтр не даёт предиката — фильтровать нечего', () => {
    expect(createFilterPredicate(EMPTY_FILTER)).toBeNull();
  });

  it('фильтр только с сортировкой тоже не даёт предиката', () => {
    expect(
      createFilterPredicate(filter({ sort: { column: 'budget', direction: 'desc' } })),
    ).toBeNull();
  });

  it('узлы без данных по эффективности под условие не подпадают', () => {
    const empty = buildModel([node('a', null, 'Пусто', 0, 100, 0)], { epoch: 'e1', version: 1 });
    const predicate = createFilterPredicate(filter({ performance: { min: null, max: 100 } }))!;

    expect(predicate(empty.byId.get('a')!, empty)).toBe(false);
  });
});

describe('describeFilter', () => {
  it('описывает условия по-человечески', () => {
    expect(
      describeFilter(filter({ levels: ['department'], budget: { min: 50_000_000, max: null } })),
    ).toEqual(['Уровень: отделы', 'Бюджет: от 50 млн']);
  });

  it('описывает обе границы и проценты', () => {
    expect(describeFilter(filter({ performance: { min: 60, max: 80 } }))).toEqual([
      'Эффективность: 60%–80%',
    ]);
  });

  it('у пустого фильтра описывать нечего', () => {
    expect(describeFilter(EMPTY_FILTER)).toEqual([]);
  });
});
