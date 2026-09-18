import { describe, expect, it } from 'vitest';

import type { OrgNode } from '@org/contracts';

import { averageOf, computeAggregates, contributionOf } from './aggregate';
import { buildModel } from './buildModel';

const node = (
  id: string,
  parentId: string | null,
  headcount: number,
  budget: number,
  performance: number,
): OrgNode => ({
  id,
  name: id,
  parentId,
  headcount,
  budget,
  performance,
  updatedAt: '2026-09-18T09:00:00.000Z',
});

const rev = { epoch: 'e1', version: 1 };

const aggregatesOf = (nodes: OrgNode[]) => buildModel(nodes, rev).aggregates;

describe('агрегация по поддереву', () => {
  it('у листа агрегат равен его собственным показателям', () => {
    const aggregates = aggregatesOf([node('team', null, 10, 5_000_000, 80)]);

    expect(aggregates.get('team')).toEqual({
      headcount: 10,
      budget: 5_000_000,
      perfWeight: 800,
      avgPerformance: 80,
    });
  });

  it('суммирует узел и всех его потомков на трёх уровнях', () => {
    const aggregates = aggregatesOf([
      node('div', null, 4, 9_000_000, 90),
      node('dep', 'div', 3, 7_000_000, 89),
      node('team-a', 'dep', 10, 2_000_000, 50),
      node('team-b', 'dep', 5, 3_000_000, 70),
    ]);

    // Дивизион: 4 + 3 + 10 + 5 человек, 9 + 7 + 2 + 3 млн.
    expect(aggregates.get('div')?.headcount).toBe(22);
    expect(aggregates.get('div')?.budget).toBe(21_000_000);

    // Отдел: только он и его две команды.
    expect(aggregates.get('dep')?.headcount).toBe(18);
    expect(aggregates.get('dep')?.budget).toBe(12_000_000);

    // Лист не включает ничего чужого.
    expect(aggregates.get('team-a')?.headcount).toBe(10);
  });

  it('собственные показатели узла входят в его же сумму', () => {
    const aggregates = aggregatesOf([
      node('div', null, 4, 1_000_000, 50),
      node('team', 'div', 6, 2_000_000, 50),
    ]);

    expect(aggregates.get('div')?.headcount).toBe(10);
    expect(aggregates.get('div')?.budget).toBe(3_000_000);
  });

  it('средняя эффективность взвешена по численности: большая команда перевешивает малую', () => {
    const aggregates = aggregatesOf([
      node('dep', null, 0, 0, 0),
      node('big', 'dep', 90, 1, 90),
      node('small', 'dep', 10, 1, 10),
    ]);

    // Среднее арифметическое дало бы 50; взвешенное — (90·90 + 10·10) / 100 = 82.
    expect(aggregates.get('dep')?.avgPerformance).toBe(82);
  });

  it('взвешенное среднее не равно простому среднему по узлам', () => {
    const aggregates = aggregatesOf([
      node('dep', null, 0, 0, 0),
      node('a', 'dep', 1, 1, 100),
      node('b', 'dep', 99, 1, 0),
    ]);

    expect(aggregates.get('dep')?.avgPerformance).toBe(1);
  });

  it('пустое по людям поддерево даёт null, а не деление на ноль', () => {
    const aggregates = aggregatesOf([node('dep', null, 0, 1_000_000, 70)]);

    expect(aggregates.get('dep')?.avgPerformance).toBeNull();
  });

  it('считает несколько корней независимо', () => {
    const aggregates = aggregatesOf([
      node('a', null, 5, 1_000_000, 60),
      node('b', null, 7, 2_000_000, 80),
      node('a-team', 'a', 3, 500_000, 40),
    ]);

    expect(aggregates.get('a')?.headcount).toBe(8);
    expect(aggregates.get('b')?.headcount).toBe(7);
  });

  it('корректен на глубоком дереве — обход идёт без рекурсии', () => {
    const chain: OrgNode[] = [];
    for (let i = 0; i < 2_000; i += 1) {
      chain.push(node(`n-${i}`, i === 0 ? null : `n-${i - 1}`, 1, 1, 50));
    }

    const aggregates = buildModel(chain, rev).aggregates;

    expect(aggregates.get('n-0')?.headcount).toBe(2_000);
    expect(aggregates.get('n-1999')?.headcount).toBe(1);
  });

  it('пустая модель даёт пустые агрегаты', () => {
    expect(aggregatesOf([]).size).toBe(0);
  });
});

describe('идентичность агрегатов', () => {
  const nodes = [
    node('div', null, 4, 9_000_000, 90),
    node('dep-a', 'div', 3, 7_000_000, 80),
    node('dep-b', 'div', 2, 4_000_000, 60),
    node('team', 'dep-a', 10, 2_000_000, 50),
  ];

  it('та же ревизия — модель, а с ней и агрегаты, не пересчитываются', () => {
    const first = buildModel(nodes, rev);
    const second = buildModel(nodes, rev, first);

    expect(second).toBe(first);
    expect(second.aggregates).toBe(first.aggregates);
  });

  it('при изменении узла объекты незатронутых агрегатов переиспользуются', () => {
    const before = buildModel(nodes, rev);
    const changed = nodes.map((item) => (item.id === 'team' ? { ...item, headcount: 11 } : item));
    const after = buildModel(changed, { epoch: 'e1', version: 2 }, before);

    // Ветка dep-b изменения не касаются.
    expect(after.aggregates.get('dep-b')).toBe(before.aggregates.get('dep-b'));

    // Сам узел и его предки пересчитаны.
    expect(after.aggregates.get('team')).not.toBe(before.aggregates.get('team'));
    expect(after.aggregates.get('dep-a')).not.toBe(before.aggregates.get('dep-a'));
    expect(after.aggregates.get('div')).not.toBe(before.aggregates.get('div'));
    expect(after.aggregates.get('div')?.headcount).toBe(20);
  });
});

describe('вспомогательные функции', () => {
  it('contributionOf берёт только собственные показатели узла', () => {
    expect(contributionOf(node('x', null, 3, 100, 40))).toEqual({
      headcount: 3,
      budget: 100,
      perfWeight: 120,
    });
  });

  it('averageOf возвращает null при нулевой численности', () => {
    expect(averageOf(0, 0)).toBeNull();
    expect(averageOf(4, 200)).toBe(50);
  });

  it('computeAggregates переиспользует прежний объект, если значения совпали', () => {
    const model = buildModel([node('a', null, 1, 1, 1)], rev);
    const again = computeAggregates({
      byId: model.byId,
      depthOf: model.depthOf,
      previous: model.aggregates,
    });

    expect(again.get('a')).toBe(model.aggregates.get('a'));
  });
});
