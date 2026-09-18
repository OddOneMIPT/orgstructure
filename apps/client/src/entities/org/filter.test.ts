import { describe, expect, it } from 'vitest';

import type { OrgNode } from '@org/contracts';

import { buildModel } from './buildModel';
import { createNamePredicate, isVisible, selectFilteredView, splitByMatch } from './filter';

const node = (id: string, parentId: string | null, name: string): OrgNode => ({
  id,
  name,
  parentId,
  headcount: 5,
  budget: 1_000_000,
  performance: 70,
  updatedAt: '2026-09-18T09:00:00.000Z',
});

const model = buildModel(
  [
    node('div', null, 'Технологии'),
    node('dep', 'div', 'Инфраструктура'),
    node('team', 'dep', 'Облако'),
    node('other', null, 'Коммерция'),
  ],
  { epoch: 'e1', version: 1 },
);

const viewFor = (query: string) => selectFilteredView(model, createNamePredicate(query));

describe('selectFilteredView', () => {
  it('без предиката показывает всё', () => {
    const view = selectFilteredView(model, null);

    expect(view.isActive).toBe(false);
    expect(isVisible(view, 'team')).toBe(true);
  });

  it('оставляет совпадение вместе с его предками — путь до узла не рвётся', () => {
    const view = viewFor('облако');

    expect(view.matched).toEqual(new Set(['team']));
    expect([...view.visible].sort()).toEqual(['dep', 'div', 'team']);
  });

  it('предок совпадением не считается: подсвечивать его не нужно', () => {
    const view = viewFor('облако');

    expect(view.matched.has('div')).toBe(false);
  });

  it('скрывает ветки без совпадений', () => {
    const view = viewFor('облако');

    expect(isVisible(view, 'other')).toBe(false);
  });

  it('совпадение по родителю не тянет за собой потомков', () => {
    const view = viewFor('Инфраструктура');

    expect(view.matched).toEqual(new Set(['dep']));
    expect(isVisible(view, 'team')).toBe(false);
  });

  it('регистр не важен', () => {
    expect(viewFor('ОБЛАКО').matched).toEqual(new Set(['team']));
  });

  it('пустой запрос равносилен отсутствию фильтра', () => {
    expect(viewFor('   ').isActive).toBe(false);
  });

  it('ничего не найдено — пустое множество, а не ошибка', () => {
    const view = viewFor('такого нет');

    expect(view.isActive).toBe(true);
    expect(view.visible.size).toBe(0);
  });

  it('несколько совпадений в разных ветках', () => {
    const view = viewFor('о');

    expect(view.matched.has('team')).toBe(true);
    expect(view.matched.has('other')).toBe(true);
  });
});

describe('splitByMatch', () => {
  it('выделяет вхождение, сохраняя исходный регистр', () => {
    expect(splitByMatch('Инфраструктура', 'ФРА')).toEqual([
      { text: 'Ин', matched: false },
      { text: 'фра', matched: true },
      { text: 'структура', matched: false },
    ]);
  });

  it('находит все вхождения', () => {
    expect(splitByMatch('ара', 'а')).toEqual([
      { text: 'а', matched: true },
      { text: 'р', matched: false },
      { text: 'а', matched: true },
    ]);
  });

  it('вхождение в начале и в конце', () => {
    expect(splitByMatch('Облако', 'Об')).toEqual([
      { text: 'Об', matched: true },
      { text: 'лако', matched: false },
    ]);
  });

  it('без совпадения возвращает строку целиком', () => {
    expect(splitByMatch('Облако', 'zzz')).toEqual([{ text: 'Облако', matched: false }]);
  });

  it('пустой запрос ничего не подсвечивает', () => {
    expect(splitByMatch('Облако', '  ')).toEqual([{ text: 'Облако', matched: false }]);
  });
});
