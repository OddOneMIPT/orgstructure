import { ancestorsOf } from './buildModel';
import type { OrgModel, OrgNode, OrgNodeId } from './types';

/** Предикат по узлу: текстовый поиск, а с шага 4 — ещё и разобранный AI-фильтр. */
export type NodePredicate = (node: OrgNode, model: OrgModel) => boolean;

export interface FilteredView {
  /** Узлы, сами попавшие под условие. */
  readonly matched: ReadonlySet<OrgNodeId>;
  /** Что показывать: совпадения плюс их предки. */
  readonly visible: ReadonlySet<OrgNodeId>;
  readonly isActive: boolean;
}

/** Фильтр не задан — показываем всё. */
export const ALL_VISIBLE: FilteredView = {
  matched: new Set(),
  visible: new Set(),
  isActive: false,
};

/**
 * Один фильтр на оба представления: и таблица, и дерево показывают одно множество узлов.
 *
 * В `visible` попадают предки совпадений — иначе дерево рассыпалось бы на обрывки, а по
 * таблице было бы непонятно, к какому дивизиону относится найденная команда. Предки при
 * этом не считаются совпадениями: подсвечивать и раскрывать их надо по-разному.
 */
export function selectFilteredView(model: OrgModel, predicate: NodePredicate | null): FilteredView {
  if (!predicate) return ALL_VISIBLE;

  const matched = new Set<OrgNodeId>();
  for (const node of model.byId.values()) {
    if (predicate(node, model)) matched.add(node.id);
  }

  const visible = new Set<OrgNodeId>(matched);
  for (const id of matched) {
    for (const ancestor of ancestorsOf(model, id)) {
      if (visible.has(ancestor)) break; // выше по пути уже добавлено
      visible.add(ancestor);
    }
  }

  return { matched, visible, isActive: true };
}

export const isVisible = (view: FilteredView, id: OrgNodeId): boolean =>
  !view.isActive || view.visible.has(id);

/** Текстовый поиск по названию: регистронезависимое вхождение. */
export function createNamePredicate(query: string): NodePredicate | null {
  const needle = query.trim().toLocaleLowerCase('ru');
  if (needle === '') return null;

  return (node) => node.name.toLocaleLowerCase('ru').includes(needle);
}

export interface NamePart {
  text: string;
  matched: boolean;
}

/**
 * Разбивает название на части для подсветки `<mark>`.
 * Регистр сохраняется: подсвечивается исходный текст, а не приведённый к нижнему.
 */
export function splitByMatch(name: string, query: string): NamePart[] {
  const needle = query.trim().toLocaleLowerCase('ru');
  if (needle === '') return [{ text: name, matched: false }];

  const haystack = name.toLocaleLowerCase('ru');
  const parts: NamePart[] = [];
  let from = 0;

  for (;;) {
    const at = haystack.indexOf(needle, from);
    if (at === -1) break;

    if (at > from) parts.push({ text: name.slice(from, at), matched: false });
    parts.push({ text: name.slice(at, at + needle.length), matched: true });
    from = at + needle.length;
  }

  if (from < name.length) parts.push({ text: name.slice(from), matched: false });

  return parts.length > 0 ? parts : [{ text: name, matched: false }];
}
