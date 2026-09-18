import { describe, expect, it } from 'vitest';

import type { OrgNode, Revision } from '@org/contracts';

import { ancestorsOf, buildModel } from './buildModel';
import { IntegrityError } from './errors';

const rev = (version: number, epoch = 'e1'): Revision => ({ epoch, version });

const node = (id: string, parentId: string | null, patch: Partial<OrgNode> = {}): OrgNode => ({
  id,
  name: id,
  parentId,
  headcount: 10,
  budget: 1_000_000,
  performance: 70,
  updatedAt: '2026-09-18T09:00:00.000Z',
  ...patch,
});

/** Дивизион с двумя отделами, у первого — две команды. */
const tree = (): OrgNode[] => [
  node('div', null, { name: 'Технологии' }),
  node('dep-b', 'div', { name: 'Бета' }),
  node('dep-a', 'div', { name: 'Альфа' }),
  node('team-1', 'dep-a', { name: 'Первая' }),
  node('team-2', 'dep-a', { name: 'Вторая' }),
];

describe('buildModel', () => {
  it('строит индексы по плоскому массиву', () => {
    const model = buildModel(tree(), rev(1));

    expect(model.byId.size).toBe(5);
    expect(model.roots).toEqual(['div']);
    expect(model.childrenOf.get('dep-a')).toEqual(['team-2', 'team-1']);
    expect(model.depthOf.get('team-1')).toBe(2);
  });

  it('сортирует детей по имени через русский коллатор', () => {
    const model = buildModel(tree(), rev(1));
    expect(model.childrenOf.get('div')).toEqual(['dep-a', 'dep-b']);
  });

  it('пустой массив даёт пустую модель, а не ошибку', () => {
    const model = buildModel([], rev(1));

    expect(model.byId.size).toBe(0);
    expect(model.roots).toEqual([]);
  });

  it('поддерживает несколько корней', () => {
    const model = buildModel([node('a', null), node('b', null)], rev(1));
    expect(model.roots).toHaveLength(2);
  });

  describe('целостность', () => {
    it('дубликат id', () => {
      const nodes = [node('a', null), node('a', null)];
      expect(() => buildModel(nodes, rev(1))).toThrow(IntegrityError);
      expect(() => buildModel(nodes, rev(1))).toThrow(/одинаковым id/);
    });

    it('сирота', () => {
      const nodes = [node('a', null), node('b', 'нет-такого')];
      expect(() => buildModel(nodes, rev(1))).toThrow(/несуществующего родителя/);
    });

    it('цикл', () => {
      const nodes = [node('a', 'b'), node('b', 'a')];
      expect(() => buildModel(nodes, rev(1))).toThrow(/цикл/);
    });

    it('цикл не мешает увидеть корректную часть дерева как ошибку целиком', () => {
      const nodes = [node('root', null), node('a', 'b'), node('b', 'a')];
      const error = (() => {
        try {
          buildModel(nodes, rev(1));
        } catch (caught) {
          return caught as IntegrityError;
        }
        return null;
      })();

      expect(error?.reason).toBe('cycle');
      expect(error?.ids).toEqual(expect.arrayContaining(['a', 'b']));
    });
  });

  describe('идентичность', () => {
    it('та же ревизия возвращает прежнюю модель без пересборки', () => {
      const prev = buildModel(tree(), rev(7));
      const next = buildModel(tree(), rev(7), prev);

      expect(next).toBe(prev);
    });

    it('та же версия при другой эпохе строит новую модель — это защита от рестарта сервера', () => {
      const prev = buildModel(tree(), rev(7, 'старая'));
      const next = buildModel(tree(), rev(7, 'новая'), prev);

      expect(next).not.toBe(prev);
      expect(next.revision).toEqual(rev(7, 'новая'));
    });

    it('неизвестная ревизия никогда не считается совпавшей', () => {
      const prev = buildModel(tree(), null);
      const next = buildModel(tree(), null, prev);

      expect(next).not.toBe(prev);
    });

    it('неизменившиеся узлы переиспользуют объекты прошлой модели', () => {
      const prev = buildModel(tree(), rev(1));
      const changed = tree().map((item) =>
        item.id === 'team-1' ? { ...item, headcount: 99 } : item,
      );
      const next = buildModel(changed, rev(2), prev);

      expect(next.byId.get('div')).toBe(prev.byId.get('div'));
      expect(next.byId.get('team-2')).toBe(prev.byId.get('team-2'));
      expect(next.byId.get('team-1')).not.toBe(prev.byId.get('team-1'));
      expect(next.byId.get('team-1')?.headcount).toBe(99);
    });

    it('проверка ревизии идёт раньше проверки целостности', () => {
      const prev = buildModel(tree(), rev(3));
      const broken = [node('a', 'нет-такого')];

      expect(buildModel(broken, rev(3), prev)).toBe(prev);
    });
  });
});

describe('ancestorsOf', () => {
  it('возвращает путь до корня', () => {
    const model = buildModel(tree(), rev(1));
    expect(ancestorsOf(model, 'team-1')).toEqual(['dep-a', 'div']);
  });

  it('у корня предков нет', () => {
    const model = buildModel(tree(), rev(1));
    expect(ancestorsOf(model, 'div')).toEqual([]);
  });

  it('у неизвестного узла предков нет', () => {
    const model = buildModel(tree(), rev(1));
    expect(ancestorsOf(model, 'нет-такого')).toEqual([]);
  });
});
