import { ancestorsOf, type OrgModel, type OrgNodeId } from '@/entities/org';
import { createStore, useStore } from '@/shared/lib/createStore';

export interface TreeUiState {
  expanded: ReadonlySet<OrgNodeId>;
  /** Ревизия, для которой уже выставили состояние по умолчанию. */
  initializedFor: string | null;
}

const EMPTY: ReadonlySet<OrgNodeId> = new Set();

export const treeUiStore = createStore<TreeUiState>({
  expanded: EMPTY,
  initializedFor: null,
});

const revisionKey = (model: OrgModel): string =>
  model.revision ? `${model.revision.epoch}.${model.revision.version}` : 'unknown';

/** Корневые узлы, у которых есть дети. */
function defaultExpanded(model: OrgModel): Set<OrgNodeId> {
  const expanded = new Set<OrgNodeId>();

  for (const [id, depth] of model.depthOf) {
    if (depth === 0 && (model.childrenOf.get(id)?.length ?? 0) > 0) {
      expanded.add(id);
    }
  }

  return expanded;
}

/**
 * «Второй уровень открыт по умолчанию»: раскрыты корни, поэтому видно два уровня —
 * дивизионы и отделы. Команды пользователь раскрывает сам, иначе дерево открывается
 * целиком и теряет смысл сворачивания.
 *
 * Делается один раз на первую загрузку: дальше состояние принадлежит пользователю
 * и переживает ревалидации.
 */
export function initializeExpanded(model: OrgModel): void {
  treeUiStore.setState((prev) => {
    if (prev.initializedFor !== null || model.byId.size === 0) return prev;
    return { expanded: defaultExpanded(model), initializedFor: revisionKey(model) };
  });
}

/** Раскрывает ветку, если она свёрнута. Уже раскрытую не трогает. */
export function expandNode(id: OrgNodeId): void {
  treeUiStore.setState((prev) => {
    if (prev.expanded.has(id)) return prev;

    const expanded = new Set(prev.expanded);
    expanded.add(id);
    return { ...prev, expanded };
  });
}

export function toggleNode(id: OrgNodeId): void {
  treeUiStore.setState((prev) => {
    const expanded = new Set(prev.expanded);
    if (!expanded.delete(id)) expanded.add(id);
    return { ...prev, expanded };
  });
}

export function expandAll(model: OrgModel): void {
  treeUiStore.setState((prev) => {
    const expanded = new Set<OrgNodeId>();
    for (const [id, children] of model.childrenOf) {
      if (id !== null && children.length > 0) expanded.add(id);
    }
    return { ...prev, expanded };
  });
}

/** Раскрывает путь до узла — нужно, когда его выбрали в таблице. */
export function expandAncestors(model: OrgModel, id: OrgNodeId): void {
  const ancestors = ancestorsOf(model, id);
  if (ancestors.length === 0) return;

  treeUiStore.setState((prev) => {
    if (ancestors.every((ancestor) => prev.expanded.has(ancestor))) return prev;

    const expanded = new Set(prev.expanded);
    for (const ancestor of ancestors) expanded.add(ancestor);
    return { ...prev, expanded };
  });
}

export function collapseAll(): void {
  treeUiStore.setState((prev) => (prev.expanded.size === 0 ? prev : { ...prev, expanded: EMPTY }));
}

/** Каждый узел подписан только на собственное состояние — в этом весь смысл селекторов. */
export function useIsExpanded(id: OrgNodeId): boolean {
  return useStore(treeUiStore, (state) => state.expanded.has(id));
}

export function useExpandedCount(): number {
  return useStore(treeUiStore, (state) => state.expanded.size);
}
