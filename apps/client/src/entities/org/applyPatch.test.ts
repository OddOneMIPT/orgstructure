import type { NodeChange, OrgNode } from '@org/contracts';
import { describe, expect, it } from 'vitest';

import { applyPatch } from './applyPatch';
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

/**
 * div
 *   dep-a → team-1, team-2
 *   dep-b → team-3
 */
const nodes = (): OrgNode[] => [
  node('div', null, 4, 9_000_000, 90),
  node('dep-a', 'div', 3, 7_000_000, 80),
  node('team-1', 'dep-a', 10, 2_000_000, 50),
  node('team-2', 'dep-a', 5, 3_000_000, 70),
  node('dep-b', 'div', 2, 4_000_000, 60),
  node('team-3', 'dep-b', 8, 1_000_000, 40),
];

const rev = (version: number, epoch = 'e1') => ({ epoch, version });
const at = (n: number) => `2026-09-18T10:0${n}:00.000Z`;

/** Тот же патч, применённый к сырым узлам, — для сравнения с полным пересчётом. */
const applyToNodes = (source: OrgNode[], changes: NodeChange[]): OrgNode[] =>
  source.map((item) => {
    const change = changes.find((candidate) => candidate.id === item.id);
    if (!change) return item;

    return {
      ...item,
      updatedAt: change.updatedAt,
      ...(change.headcount === undefined ? {} : { headcount: change.headcount }),
      ...(change.budget === undefined ? {} : { budget: change.budget }),
      ...(change.performance === undefined ? {} : { performance: change.performance }),
    };
  });

describe('applyPatch', () => {
  it('обновляет сам узел', () => {
    const model = buildModel(nodes(), rev(1));
    const next = applyPatch(model, [{ id: 'team-1', updatedAt: at(1), headcount: 12 }], rev(2));

    expect(next?.byId.get('team-1')?.headcount).toBe(12);
    expect(next?.revision).toEqual(rev(2));
  });

  it('поднимает изменение вверх по предкам', () => {
    const model = buildModel(nodes(), rev(1));
    const before = model.aggregates.get('div')?.headcount ?? 0;

    const next = applyPatch(model, [{ id: 'team-1', updatedAt: at(1), headcount: 12 }], rev(2));

    expect(next?.aggregates.get('team-1')?.headcount).toBe(12);
    expect(next?.aggregates.get('dep-a')?.headcount).toBe(20);
    expect(next?.aggregates.get('div')?.headcount).toBe(before + 2);
  });

  it('не трогает соседнюю ветку', () => {
    const model = buildModel(nodes(), rev(1));
    const next = applyPatch(model, [{ id: 'team-1', updatedAt: at(1), headcount: 12 }], rev(2));

    expect(next?.aggregates.get('dep-b')).toBe(model.aggregates.get('dep-b'));
    expect(next?.aggregates.get('team-3')).toBe(model.aggregates.get('team-3'));
    expect(next?.byId.get('team-3')).toBe(model.byId.get('team-3'));
  });

  it('меняет ссылки ровно у узла и его предков', () => {
    const model = buildModel(nodes(), rev(1));
    const next = applyPatch(model, [{ id: 'team-1', updatedAt: at(1), performance: 55 }], rev(2))!;

    const changed = [...next.aggregates.entries()]
      .filter(([id, aggregate]) => aggregate !== model.aggregates.get(id))
      .map(([id]) => id)
      .sort();

    expect(changed).toEqual(['dep-a', 'div', 'team-1']);
  });

  it('пересчитывает взвешенное среднее предков', () => {
    const model = buildModel(nodes(), rev(1));
    const next = applyPatch(model, [{ id: 'team-1', updatedAt: at(1), performance: 100 }], rev(2))!;

    const aggregate = next.aggregates.get('dep-a')!;
    expect(aggregate.avgPerformance).toBeCloseTo(aggregate.perfWeight / aggregate.headcount, 10);
    expect(aggregate.avgPerformance).toBeGreaterThan(
      model.aggregates.get('dep-a')!.avgPerformance!,
    );
  });

  it('структура модели переиспользуется — патч её не меняет', () => {
    const model = buildModel(nodes(), rev(1));
    const next = applyPatch(model, [{ id: 'team-1', updatedAt: at(1), budget: 9 }], rev(2));

    expect(next?.childrenOf).toBe(model.childrenOf);
    expect(next?.depthOf).toBe(model.depthOf);
    expect(next?.roots).toBe(model.roots);
  });

  it('применяет несколько изменений за один патч', () => {
    const model = buildModel(nodes(), rev(1));
    const next = applyPatch(
      model,
      [
        { id: 'team-1', updatedAt: at(1), headcount: 11 },
        { id: 'team-3', updatedAt: at(1), headcount: 9 },
      ],
      rev(2),
    );

    expect(next?.aggregates.get('div')?.headcount).toBe(34);
  });

  it('несколько изменений в одной ветке складываются', () => {
    const model = buildModel(nodes(), rev(1));
    const next = applyPatch(
      model,
      [
        { id: 'team-1', updatedAt: at(1), headcount: 11 },
        { id: 'team-2', updatedAt: at(1), headcount: 6 },
      ],
      rev(2),
    );

    expect(next?.aggregates.get('dep-a')?.headcount).toBe(20);
  });

  it('неизвестный узел даёт null — это сигнал к полному рефетчу', () => {
    const model = buildModel(nodes(), rev(1));

    expect(applyPatch(model, [{ id: 'нет-такого', updatedAt: at(1) }], rev(2))).toBeNull();
  });

  it('изменение только updatedAt не трогает агрегаты', () => {
    const model = buildModel(nodes(), rev(1));
    const next = applyPatch(model, [{ id: 'team-1', updatedAt: at(5) }], rev(2))!;

    expect(next.byId.get('team-1')?.updatedAt).toBe(at(5));
    expect(next.aggregates.get('div')).toBe(model.aggregates.get('div'));
  });
});

describe('инвариант: инкремент ≡ полный пересчёт', () => {
  /** Детерминированный PRNG: падение теста должно воспроизводиться. */
  const createRandom = (seed: number) => {
    let state = seed >>> 0;
    return () => {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  it.each([1, 7, 42, 2026])(
    'совпадает на случайной последовательности патчей (seed %i)',
    (seed) => {
      const random = createRandom(seed);
      let source = nodes();
      let model = buildModel(source, rev(1));
      const ids = source.map((item) => item.id);

      for (let step = 0; step < 40; step += 1) {
        const count = 1 + Math.floor(random() * 3);
        const changes: NodeChange[] = [];

        for (let i = 0; i < count; i += 1) {
          const id = ids[Math.floor(random() * ids.length)]!;
          if (changes.some((change) => change.id === id)) continue;

          changes.push({
            id,
            updatedAt: at(step % 10),
            headcount: Math.floor(random() * 30),
            performance: Math.floor(random() * 101),
            budget: Math.floor(random() * 10) * 1_000_000,
          });
        }

        if (changes.length === 0) continue;

        const version = step + 2;
        const incremental = applyPatch(model, changes, rev(version));
        expect(incremental).not.toBeNull();

        source = applyToNodes(source, changes);
        const full = buildModel(source, rev(version));

        for (const id of ids) {
          expect(incremental!.aggregates.get(id)).toEqual(full.aggregates.get(id));
          expect(incremental!.byId.get(id)).toEqual(full.byId.get(id));
        }

        model = incremental!;
      }
    },
  );
});
