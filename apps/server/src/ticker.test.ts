import { OrgNodeSchema, type OrgNode } from '@org/contracts';
import { describe, expect, it } from 'vitest';

import { OrgStore } from './store.js';
import { createTicker } from './ticker.js';

const node = (id: string, headcount = 10, performance = 50): OrgNode => ({
  id,
  name: `Узел ${id}`,
  parentId: null,
  headcount,
  budget: 1_000_000,
  performance,
  updatedAt: '2026-09-18T09:00:00.000Z',
});

/** Детерминированная «случайность»: без неё тест ловил бы разное поведение на каждом прогоне. */
const sequence = (values: number[]) => {
  let index = 0;
  return () => values[index++ % values.length] ?? 0;
};

describe('createTicker', () => {
  it('меняет метрики и поднимает версию', () => {
    const store = new OrgStore([node('a'), node('b')], 'e1');
    const ticker = createTicker({
      store,
      intervalMs: 0,
      random: sequence([0.1, 0.4, 0.9, 0.2]),
      now: () => new Date('2026-09-18T10:00:00.000Z'),
    });

    ticker.tick();

    expect(store.revision.version).toBe(1);
  });

  it('оставляет значения в границах схемы — иначе клиент отверг бы патч', () => {
    const store = new OrgStore([node('a', 1, 0), node('b', 200, 100)], 'e1');
    const ticker = createTicker({
      store,
      intervalMs: 0,
      random: sequence([0.99, 0.0, 0.99, 0.0, 0.5]),
      now: () => new Date('2026-09-18T10:00:00.000Z'),
    });

    for (let i = 0; i < 20; i += 1) ticker.tick();

    for (const snapshot of store.snapshot().nodes) {
      expect(OrgNodeSchema.safeParse(snapshot).success).toBe(true);
    }
  });

  it('не стартует при нулевом интервале', () => {
    const store = new OrgStore([node('a')], 'e1');
    const ticker = createTicker({ store, intervalMs: 0 });

    ticker.start();
    ticker.stop();

    expect(store.revision.version).toBe(0);
  });
});

describe('OrgStore.mutate', () => {
  it('поднимает версию на единицу за патч', () => {
    const store = new OrgStore([node('a')], 'e1');

    store.mutate([{ id: 'a', updatedAt: '2026-09-18T10:00:00.000Z', headcount: 11 }]);
    store.mutate([{ id: 'a', updatedAt: '2026-09-18T10:01:00.000Z', headcount: 12 }]);

    expect(store.revision.version).toBe(2);
  });

  it('применяет только переданные поля', () => {
    const store = new OrgStore([node('a', 10, 50)], 'e1');

    store.mutate([{ id: 'a', updatedAt: '2026-09-18T10:00:00.000Z', headcount: 11 }]);

    const updated = store.snapshot().nodes[0];
    expect(updated?.headcount).toBe(11);
    expect(updated?.performance).toBe(50);
  });

  it('уведомляет подписчиков применённым патчем', () => {
    const store = new OrgStore([node('a')], 'e1');
    const seen: unknown[] = [];
    store.subscribe((patch) => seen.push(patch));

    store.mutate([{ id: 'a', updatedAt: '2026-09-18T10:00:00.000Z', budget: 5 }]);

    expect(seen).toEqual([
      {
        epoch: 'e1',
        version: 1,
        changes: [{ id: 'a', updatedAt: '2026-09-18T10:00:00.000Z', budget: 5 }],
      },
    ]);
  });

  it('изменение неизвестного узла не поднимает версию', () => {
    const store = new OrgStore([node('a')], 'e1');

    expect(store.mutate([{ id: 'нет-такого', updatedAt: '2026-09-18T10:00:00.000Z' }])).toBeNull();
    expect(store.revision.version).toBe(0);
  });

  it('отписка прекращает уведомления', () => {
    const store = new OrgStore([node('a')], 'e1');
    const seen: unknown[] = [];
    const unsubscribe = store.subscribe((patch) => seen.push(patch));

    unsubscribe();
    store.mutate([{ id: 'a', updatedAt: '2026-09-18T10:00:00.000Z', budget: 5 }]);

    expect(seen).toEqual([]);
  });
});
