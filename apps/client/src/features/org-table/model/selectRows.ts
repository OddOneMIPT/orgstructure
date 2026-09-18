import {
  isVisible,
  type Aggregate,
  type FilteredView,
  type OrgModel,
  type OrgNodeId,
} from '@/entities/org';

export type SortColumn = 'name' | 'level' | 'headcount' | 'budget' | 'performance';
export type SortDirection = 'asc' | 'desc';

export interface Sort {
  column: SortColumn;
  direction: SortDirection;
}

export interface TableRow {
  id: OrgNodeId;
  name: string;
  depth: number;
  aggregate: Aggregate;
  /** Собственный штат узла — для колонки «3 / 128» и тултипа. */
  ownHeadcount: number;
  ownBudget: number;
  updatedAt: string;
  isMatched: boolean;
}

const collator = new Intl.Collator('ru');

/**
 * Узлы без данных уходят в конец при любом направлении, поэтому их порядок считается
 * до применения знака: иначе `desc` поднимал бы пустые значения наверх.
 */
function compareNullsLast(column: SortColumn, a: TableRow, b: TableRow): number {
  if (column !== 'performance') return 0;

  const left = a.aggregate.avgPerformance;
  const right = b.aggregate.avgPerformance;
  if (left === right) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return 0;
}

function compareBy(column: SortColumn, a: TableRow, b: TableRow): number {
  switch (column) {
    case 'name':
      return collator.compare(a.name, b.name);
    case 'level':
      return a.depth - b.depth || collator.compare(a.name, b.name);
    case 'headcount':
      return a.aggregate.headcount - b.aggregate.headcount;
    case 'budget':
      return a.aggregate.budget - b.aggregate.budget;
    case 'performance':
      return (a.aggregate.avgPerformance ?? 0) - (b.aggregate.avgPerformance ?? 0);
  }
}

export interface SelectRowsOptions {
  view: FilteredView;
  sort: Sort | null;
}

/**
 * Строки таблицы. Без сортировки — порядок обхода дерева, поэтому отступ по уровню
 * читается как структура (так в макете). При активной сортировке структура всё равно
 * нарушается, и отступ только мешал бы — там плоский список.
 *
 * Чистая функция: результат мемоизируется по (модель, фильтр, сортировка).
 */
export function selectRows(model: OrgModel, { view, sort }: SelectRowsOptions): TableRow[] {
  const rows: TableRow[] = [];

  const toRow = (id: OrgNodeId, depth: number): TableRow | null => {
    const node = model.byId.get(id);
    const aggregate = model.aggregates.get(id);
    if (!node || !aggregate) return null;

    return {
      id,
      name: node.name,
      depth,
      aggregate,
      ownHeadcount: node.headcount,
      ownBudget: node.budget,
      updatedAt: node.updatedAt,
      isMatched: view.isActive && view.matched.has(id),
    };
  };

  // Обход в глубину без рекурсии: порядок тот же, что видит пользователь в дереве.
  const stack: { id: OrgNodeId; depth: number }[] = [...model.roots]
    .reverse()
    .map((id) => ({ id, depth: 0 }));

  for (let item = stack.pop(); item !== undefined; item = stack.pop()) {
    if (isVisible(view, item.id)) {
      const row = toRow(item.id, item.depth);
      if (row) rows.push(row);
    }

    const children = model.childrenOf.get(item.id) ?? [];
    for (let i = children.length - 1; i >= 0; i -= 1) {
      const childId = children[i];
      if (childId !== undefined) stack.push({ id: childId, depth: item.depth + 1 });
    }
  }

  if (!sort) return rows;

  const sign = sort.direction === 'asc' ? 1 : -1;
  return [...rows].sort(
    (a, b) => compareNullsLast(sort.column, a, b) || sign * compareBy(sort.column, a, b),
  );
}
