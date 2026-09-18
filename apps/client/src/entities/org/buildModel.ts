import { isSameRevision, type OrgNode, type OrgNodeId, type Revision } from '@org/contracts';

import { IntegrityError } from './errors';
import type { OrgModel } from './types';

const collator = new Intl.Collator('ru');

const sameNode = (a: OrgNode, b: OrgNode): boolean =>
  a.id === b.id &&
  a.name === b.name &&
  a.parentId === b.parentId &&
  a.headcount === b.headcount &&
  a.budget === b.budget &&
  a.performance === b.performance &&
  a.updatedAt === b.updatedAt;

/**
 * Собирает модель из плоского массива.
 *
 * Проверка ревизии — первым делом, до валидации целостности и (с шага 2) до агрегации:
 * иначе обещание «агрегация считается один раз на загрузку» не выполняется, а ревалидация
 * с той же ревизией порождала бы новые объекты и лишние перерисовки.
 *
 * @throws {IntegrityError} дубликаты id, сироты или цикл.
 */
export function buildModel(
  nodes: readonly OrgNode[],
  revision: Revision | null,
  prev?: OrgModel,
): OrgModel {
  if (prev && isSameRevision(prev.revision, revision)) {
    return prev;
  }

  const byId = new Map<OrgNodeId, OrgNode>();
  const duplicates: OrgNodeId[] = [];

  for (const node of nodes) {
    if (byId.has(node.id)) {
      duplicates.push(node.id);
      continue;
    }
    // Неизменившиеся узлы переиспользуют объект из прошлой модели — иначе `memo`
    // на строках и узлах не сработает ни разу.
    const previous = prev?.byId.get(node.id);
    byId.set(node.id, previous && sameNode(previous, node) ? previous : node);
  }

  if (duplicates.length > 0) {
    throw new IntegrityError('duplicate', duplicates);
  }

  const orphans = nodes
    .filter((node) => node.parentId !== null && !byId.has(node.parentId))
    .map((node) => node.id);

  if (orphans.length > 0) {
    throw new IntegrityError('orphan', orphans);
  }

  const childrenOf = new Map<OrgNodeId | null, OrgNodeId[]>();
  for (const node of byId.values()) {
    const siblings = childrenOf.get(node.parentId);
    if (siblings) {
      siblings.push(node.id);
    } else {
      childrenOf.set(node.parentId, [node.id]);
    }
  }

  const nameOf = (id: OrgNodeId): string => byId.get(id)?.name ?? '';
  for (const siblings of childrenOf.values()) {
    siblings.sort((a, b) => collator.compare(nameOf(a), nameOf(b)));
  }

  const roots = childrenOf.get(null) ?? [];

  // Обход от корней заодно ловит циклы: узел, до которого не дошли, лежит в цикле.
  const depthOf = new Map<OrgNodeId, number>();
  const queue: { id: OrgNodeId; depth: number }[] = roots.map((id) => ({ id, depth: 0 }));

  for (let item = queue.pop(); item !== undefined; item = queue.pop()) {
    depthOf.set(item.id, item.depth);
    for (const child of childrenOf.get(item.id) ?? []) {
      queue.push({ id: child, depth: item.depth + 1 });
    }
  }

  if (depthOf.size !== byId.size) {
    const unreachable = [...byId.keys()].filter((id) => !depthOf.has(id));
    throw new IntegrityError('cycle', unreachable);
  }

  return { revision, byId, childrenOf, depthOf, roots };
}

/** Путь от родителя узла до корня. Тот же обход используют агрегация и фильтр. */
export function ancestorsOf(model: OrgModel, id: OrgNodeId): OrgNodeId[] {
  const ancestors: OrgNodeId[] = [];
  let current = model.byId.get(id)?.parentId ?? null;

  while (current !== null) {
    ancestors.push(current);
    current = model.byId.get(current)?.parentId ?? null;
  }

  return ancestors;
}

export const EMPTY_MODEL: OrgModel = {
  revision: null,
  byId: new Map(),
  childrenOf: new Map(),
  depthOf: new Map(),
  roots: [],
};
