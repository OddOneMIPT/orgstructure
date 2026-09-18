import { describe, expect, it } from 'vitest';

import { OrgNodeSchema, OrgTreeResponseSchema } from './org-node.js';

const validNode = {
  id: 'div-1',
  name: 'Разработка',
  parentId: null,
  headcount: 12,
  budget: 34_170_000,
  performance: 74.5,
  updatedAt: '2026-09-18T10:00:00.000Z',
};

describe('OrgNodeSchema', () => {
  it('принимает валидный узел', () => {
    expect(OrgNodeSchema.parse(validNode)).toEqual(validNode);
  });

  it('принимает узел с родителем', () => {
    const child = { ...validNode, id: 'dep-1', parentId: 'div-1' };
    expect(OrgNodeSchema.parse(child).parentId).toBe('div-1');
  });

  it('отвергает лишние поля, а не срезает их молча', () => {
    const result = OrgNodeSchema.safeParse({ ...validNode, extra: 'что-то новое' });
    expect(result.success).toBe(false);
  });

  it.each([
    ['performance выше 100', { performance: 100.1 }],
    ['performance ниже 0', { performance: -1 }],
    ['отрицательный headcount', { headcount: -1 }],
    ['дробный headcount', { headcount: 1.5 }],
    ['отрицательный бюджет', { budget: -1 }],
    ['пустой id', { id: '' }],
    ['пустое имя', { name: '' }],
    ['пустой parentId вместо null', { parentId: '' }],
    ['updatedAt не ISO', { updatedAt: '18.09.2026' }],
  ])('отвергает: %s', (_label, patch) => {
    expect(OrgNodeSchema.safeParse({ ...validNode, ...patch }).success).toBe(false);
  });

  it('принимает граничные значения performance', () => {
    expect(OrgNodeSchema.safeParse({ ...validNode, performance: 0 }).success).toBe(true);
    expect(OrgNodeSchema.safeParse({ ...validNode, performance: 100 }).success).toBe(true);
  });

  it('требует все поля контракта', () => {
    const { budget: _budget, ...withoutBudget } = validNode;
    expect(OrgNodeSchema.safeParse(withoutBudget).success).toBe(false);
  });
});

describe('OrgTreeResponseSchema', () => {
  it('принимает пустой массив — это валидный ответ, а не ошибка', () => {
    expect(OrgTreeResponseSchema.parse([])).toEqual([]);
  });

  it('принимает массив узлов', () => {
    expect(OrgTreeResponseSchema.parse([validNode])).toHaveLength(1);
  });

  it('отвергает не массив', () => {
    expect(OrgTreeResponseSchema.safeParse({ nodes: [validNode] }).success).toBe(false);
  });

  it('отвергает массив с одним невалидным узлом', () => {
    const broken = { ...validNode, id: 'x', performance: 1000 };
    expect(OrgTreeResponseSchema.safeParse([validNode, broken]).success).toBe(false);
  });
});
