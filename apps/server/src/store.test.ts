import type { OrgNode } from '@org/contracts';
import { describe, expect, it } from 'vitest';

import { OrgStore } from './store.js';

const node = (id: string, parentId: string | null = null): OrgNode => ({
  id,
  name: `Узел ${id}`,
  parentId,
  headcount: 5,
  budget: 1_000_000,
  performance: 70,
  updatedAt: '2026-09-18T09:00:00.000Z',
});

describe('OrgStore', () => {
  it('стартует с версии 0', () => {
    expect(new OrgStore([node('a')]).revision.version).toBe(0);
  });

  it('не отдаёт наружу внутренний массив', () => {
    const store = new OrgStore([node('a')]);

    const first = store.snapshot();
    first.nodes.push(node('подделка'));
    first.nodes[0]!.headcount = 999;

    const second = store.snapshot();
    expect(second.nodes).toHaveLength(1);
    expect(second.nodes[0]!.headcount).toBe(5);
  });

  it('не держит ссылки на узлы, переданные в конструктор', () => {
    const source = [node('a')];
    const store = new OrgStore(source);

    source[0]!.headcount = 999;

    expect(store.snapshot().nodes[0]!.headcount).toBe(5);
  });

  it('снимок содержит эпоху, версию и узлы вместе', () => {
    const store = new OrgStore([node('a')], 'epoch-1');

    expect(store.snapshot()).toEqual({
      epoch: 'epoch-1',
      version: 0,
      nodes: [node('a')],
    });
  });

  it('по умолчанию генерирует новую эпоху на каждый экземпляр', () => {
    expect(new OrgStore([node('a')]).revision.epoch).not.toBe(
      new OrgStore([node('a')]).revision.epoch,
    );
  });
});
