import { describe, expect, it } from 'vitest';

import { OrgTreeResponseSchema } from '@org/contracts';

import { createSeedNodes } from './seed.js';

const nodes = createSeedNodes();
const byId = new Map(nodes.map((node) => [node.id, node]));

const depthOf = (id: string): number => {
  let depth = 0;
  let current = byId.get(id);
  while (current?.parentId) {
    depth += 1;
    current = byId.get(current.parentId);
  }
  return depth;
};

describe('createSeedNodes', () => {
  it('проходит собственную схему ответа', () => {
    expect(OrgTreeResponseSchema.safeParse(nodes).success).toBe(true);
  });

  it('даёт не меньше 48 узлов — с запасом к требованию «минимум 40»', () => {
    expect(nodes.length).toBeGreaterThanOrEqual(48);
  });

  it('имеет не меньше трёх уровней вложенности', () => {
    const maxDepth = Math.max(...nodes.map((node) => depthOf(node.id)));
    expect(maxDepth).toBeGreaterThanOrEqual(2);
  });

  it('содержит узлы на всех трёх уровнях', () => {
    const levels = new Set(nodes.map((node) => depthOf(node.id)));
    expect(levels).toEqual(new Set([0, 1, 2]));
  });

  it('не содержит дублей id', () => {
    expect(byId.size).toBe(nodes.length);
  });

  it('не содержит сирот: каждый parentId существует', () => {
    const orphans = nodes.filter((node) => node.parentId !== null && !byId.has(node.parentId));
    expect(orphans).toEqual([]);
  });

  it('не содержит циклов: от каждого узла достижим корень', () => {
    for (const node of nodes) {
      const seen = new Set<string>();
      let current: string | null = node.id;
      while (current !== null) {
        expect(seen.has(current)).toBe(false);
        seen.add(current);
        current = byId.get(current)?.parentId ?? null;
      }
    }
  });

  it('детерминирован: два вызова дают идентичные данные, включая updatedAt', () => {
    expect(createSeedNodes()).toEqual(createSeedNodes());
  });

  it('имеет ровно 4 корня-дивизиона', () => {
    expect(nodes.filter((node) => node.parentId === null)).toHaveLength(4);
  });

  it('у каждого узла ненулевой собственный штат — иначе взвешенное среднее теряет смысл', () => {
    expect(nodes.every((node) => node.headcount > 0)).toBe(true);
  });
});
