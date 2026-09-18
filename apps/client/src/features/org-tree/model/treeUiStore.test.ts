import type { OrgNode } from '@org/contracts';
import { beforeEach, describe, expect, it } from 'vitest';

import { buildModel } from '@/entities/org';

import { collapseAll, expandAll, initializeExpanded, toggleNode, treeUiStore } from './treeUiStore';

const node = (id: string, parentId: string | null): OrgNode => ({
  id,
  name: id,
  parentId,
  headcount: 5,
  budget: 1_000_000,
  performance: 70,
  updatedAt: '2026-09-18T09:00:00.000Z',
});

/** div → dep → team, плюс лист-команда без детей на глубине 1. */
const model = buildModel(
  [node('div', null), node('dep', 'div'), node('team', 'dep'), node('lonely', 'div')],
  { epoch: 'e1', version: 1 },
);

beforeEach(() => {
  treeUiStore.setState(() => ({ expanded: new Set(), initializedFor: null }));
});

describe('initializeExpanded', () => {
  it('раскрывает уровни 0 и 1 — третий уровень виден сразу', () => {
    initializeExpanded(model);

    expect([...treeUiStore.getState().expanded].sort()).toEqual(['dep', 'div']);
  });

  it('не раскрывает узлы без детей', () => {
    initializeExpanded(model);

    expect(treeUiStore.getState().expanded.has('lonely')).toBe(false);
    expect(treeUiStore.getState().expanded.has('team')).toBe(false);
  });

  it('срабатывает один раз: выбор пользователя переживает ревалидацию', () => {
    initializeExpanded(model);
    collapseAll();
    initializeExpanded(model);

    expect(treeUiStore.getState().expanded.size).toBe(0);
  });

  it('пустую модель игнорирует, чтобы не «проинициализироваться» на пустом ответе', () => {
    initializeExpanded(buildModel([], { epoch: 'e1', version: 1 }));

    expect(treeUiStore.getState().initializedFor).toBeNull();
  });
});

describe('toggleNode', () => {
  it('раскрывает и сворачивает', () => {
    toggleNode('div');
    expect(treeUiStore.getState().expanded.has('div')).toBe(true);

    toggleNode('div');
    expect(treeUiStore.getState().expanded.has('div')).toBe(false);
  });

  it('меняет ссылку на множество — иначе подписчики не узнают об изменении', () => {
    const before = treeUiStore.getState().expanded;
    toggleNode('div');

    expect(treeUiStore.getState().expanded).not.toBe(before);
  });
});

describe('expandAll / collapseAll', () => {
  it('expandAll раскрывает все узлы, у которых есть дети', () => {
    expandAll(model);

    expect([...treeUiStore.getState().expanded].sort()).toEqual(['dep', 'div']);
  });

  it('collapseAll очищает множество', () => {
    expandAll(model);
    collapseAll();

    expect(treeUiStore.getState().expanded.size).toBe(0);
  });

  it('повторный collapseAll не трогает состояние', () => {
    collapseAll();
    const before = treeUiStore.getState();
    collapseAll();

    expect(treeUiStore.getState()).toBe(before);
  });
});
