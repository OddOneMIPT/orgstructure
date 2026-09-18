import type { OrgModel, OrgNodeId } from '@/entities/org';
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

/** Узлы с детьми на глубинах 0 и 1. */
function defaultExpanded(model: OrgModel): Set<OrgNodeId> {
  const expanded = new Set<OrgNodeId>();

  for (const [id, depth] of model.depthOf) {
    if (depth <= 1 && (model.childrenOf.get(id)?.length ?? 0) > 0) {
      expanded.add(id);
    }
  }

  return expanded;
}

/**
 * «Второй уровень открыт по умолчанию» читаем буквально: раскрыты и дивизионы, и отделы,
 * поэтому команды видно сразу. Делается один раз на первую загрузку — дальше состояние
 * принадлежит пользователю и переживает ревалидации.
 */
export function initializeExpanded(model: OrgModel): void {
  treeUiStore.setState((prev) => {
    if (prev.initializedFor !== null || model.byId.size === 0) return prev;
    return { expanded: defaultExpanded(model), initializedFor: revisionKey(model) };
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
