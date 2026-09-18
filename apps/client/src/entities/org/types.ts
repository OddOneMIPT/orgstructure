import type { OrgNode, OrgNodeId, Revision } from '@org/contracts';

/**
 * Готовая к отрисовке модель дерева. Лежит прямо в кэше react-query (ADR 002):
 * компоненты её только читают, а идентичностью объектов управляют `buildModel`
 * и (с шага 3) `applyPatch` — на этом держатся `memo` и точечная подсветка.
 */
export interface OrgModel {
  /**
   * `null` — ревизия неизвестна (ответ пришёл без разбираемого ETag).
   * В этом состоянии патчи не применяются никогда (ADR 002).
   */
  readonly revision: Revision | null;
  readonly byId: ReadonlyMap<OrgNodeId, OrgNode>;
  /** Ключ `null` — корни дерева (дивизионы). Дети отсортированы по имени. */
  readonly childrenOf: ReadonlyMap<OrgNodeId | null, readonly OrgNodeId[]>;
  readonly depthOf: ReadonlyMap<OrgNodeId, number>;
  readonly roots: readonly OrgNodeId[];
}

export type { OrgNode, OrgNodeId, Revision };
