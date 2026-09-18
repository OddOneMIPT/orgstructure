import type { NodeChange, OrgNode, OrgNodeId, Revision } from '@org/contracts';

import { type Aggregate, averageOf, contributionOf } from './aggregate';
import type { OrgModel } from './types';

interface Delta {
  headcount: number;
  budget: number;
  perfWeight: number;
}

const isZero = (delta: Delta): boolean =>
  delta.headcount === 0 && delta.budget === 0 && delta.perfWeight === 0;

function deltaBetween(before: OrgNode, after: OrgNode): Delta {
  const from = contributionOf(before);
  const to = contributionOf(after);

  return {
    headcount: to.headcount - from.headcount,
    budget: to.budget - from.budget,
    perfWeight: to.perfWeight - from.perfWeight,
  };
}

function shift(aggregate: Aggregate, delta: Delta): Aggregate {
  const headcount = aggregate.headcount + delta.headcount;
  const perfWeight = aggregate.perfWeight + delta.perfWeight;

  return {
    headcount,
    budget: aggregate.budget + delta.budget,
    perfWeight,
    avgPerformance: averageOf(headcount, perfWeight),
  };
}

function merge(node: OrgNode, change: NodeChange): OrgNode {
  return {
    ...node,
    updatedAt: change.updatedAt,
    ...(change.headcount === undefined ? {} : { headcount: change.headcount }),
    ...(change.budget === undefined ? {} : { budget: change.budget }),
    ...(change.performance === undefined ? {} : { performance: change.performance }),
  };
}

/**
 * Применяет патч к модели: узел + дельта вверх по предкам, O(глубина) на изменение.
 * Потомки не посещаются вообще — в этом весь смысл аддитивного агрегата (ADR 003).
 *
 * Возвращает `null`, если патч ссылается на неизвестный узел: значит, структура
 * разошлась и нужен полный рефетч. Вызывающий код обязан проверить результат **до**
 * записи в кэш — `setQueryData` пропускает только `undefined`, и `null` осел бы
 * в кэше как данные (ADR 004).
 */
export function applyPatch(
  model: OrgModel,
  changes: readonly NodeChange[],
  revision: Revision,
): OrgModel | null {
  const byId = new Map(model.byId);
  const aggregates = new Map(model.aggregates);
  let touched = false;

  for (const change of changes) {
    const before = byId.get(change.id);
    if (!before) return null;

    const after = merge(before, change);
    byId.set(change.id, after);
    touched = true;

    const delta = deltaBetween(before, after);
    if (isZero(delta)) continue;

    // Сам узел и путь до корня: больше ничьи суммы измениться не могли.
    let current: OrgNodeId | null = change.id;
    while (current !== null) {
      const aggregate = aggregates.get(current);
      if (aggregate) aggregates.set(current, shift(aggregate, delta));

      current = byId.get(current)?.parentId ?? null;
    }
  }

  if (!touched) return model;

  return { ...model, revision, byId, aggregates };
}
