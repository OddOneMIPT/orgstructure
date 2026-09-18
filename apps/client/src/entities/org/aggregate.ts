import type { OrgNode, OrgNodeId } from '@org/contracts';

/**
 * Суммарные показатели узла вместе со всеми его потомками.
 *
 * Хранится числитель взвешенного среднего (`perfWeight`), а не само среднее: так агрегат
 * становится аддитивным — агрегат родителя это его собственный вклад плюс сумма агрегатов
 * детей. Все слагаемые целые, поэтому многократные дельты (шаг 3) не накапливают
 * погрешность; деление выполняется один раз при чтении (ADR 003).
 */
export interface Aggregate {
  /** Σ headcount по поддереву, включая сам узел. */
  headcount: number;
  /** Σ budget по поддереву, включая сам узел. */
  budget: number;
  /** Σ performance · headcount по поддереву. */
  perfWeight: number;
  /** Взвешенное по численности среднее; `null`, когда в поддереве нет людей. */
  avgPerformance: number | null;
}

/** Собственный вклад узла — без потомков. */
export function contributionOf(node: OrgNode): Omit<Aggregate, 'avgPerformance'> {
  return {
    headcount: node.headcount,
    budget: node.budget,
    perfWeight: node.performance * node.headcount,
  };
}

export function averageOf(headcount: number, perfWeight: number): number | null {
  return headcount > 0 ? perfWeight / headcount : null;
}

export function sameAggregate(a: Aggregate, b: Aggregate): boolean {
  return (
    a.headcount === b.headcount &&
    a.budget === b.budget &&
    a.perfWeight === b.perfWeight &&
    a.avgPerformance === b.avgPerformance
  );
}

export interface ComputeAggregatesInput {
  byId: ReadonlyMap<OrgNodeId, OrgNode>;
  depthOf: ReadonlyMap<OrgNodeId, number>;
  /** Агрегаты прошлой модели: неизменившиеся объекты переиспользуются. */
  previous?: ReadonlyMap<OrgNodeId, Aggregate> | undefined;
}

/**
 * Полный расчёт — один раз на загрузку данных, O(n) и без рекурсии: узлы обходятся
 * в порядке убывания глубины, каждый добавляет свой агрегат в агрегат родителя.
 * Рекурсия здесь была бы лишним риском переполнения стека на глубоком дереве.
 */
export function computeAggregates({
  byId,
  depthOf,
  previous,
}: ComputeAggregatesInput): Map<OrgNodeId, Aggregate> {
  const sums = new Map<OrgNodeId, { headcount: number; budget: number; perfWeight: number }>();

  for (const node of byId.values()) {
    sums.set(node.id, contributionOf(node));
  }

  const byDepthDesc = [...depthOf.entries()].sort((a, b) => b[1] - a[1]);

  for (const [id] of byDepthDesc) {
    const parentId = byId.get(id)?.parentId;
    if (parentId === null || parentId === undefined) continue;

    const own = sums.get(id);
    const parent = sums.get(parentId);
    if (!own || !parent) continue;

    parent.headcount += own.headcount;
    parent.budget += own.budget;
    parent.perfWeight += own.perfWeight;
  }

  const aggregates = new Map<OrgNodeId, Aggregate>();

  for (const [id, sum] of sums) {
    const next: Aggregate = { ...sum, avgPerformance: averageOf(sum.headcount, sum.perfWeight) };
    const before = previous?.get(id);
    aggregates.set(id, before && sameAggregate(before, next) ? before : next);
  }

  return aggregates;
}
