import { randomUUID } from 'node:crypto';

import type { NodeChange, OrgNode, Revision } from '@org/contracts';

import { createSeedNodes } from './seed.js';

export interface OrgSnapshot extends Revision {
  nodes: OrgNode[];
}

export type StoreListener = (patch: { changes: NodeChange[] } & Revision) => void;

/**
 * Состояние живёт в памяти. Наружу отдаются только копии: внутренний массив не должен
 * утекать, иначе вызывающий код сможет менять данные в обход версии.
 */
export class OrgStore {
  #nodes: OrgNode[];
  #epoch: string;
  #version = 0;
  #listeners = new Set<StoreListener>();

  constructor(nodes: OrgNode[] = createSeedNodes(), epoch: string = randomUUID()) {
    this.#nodes = nodes.map((node) => ({ ...node }));
    this.#epoch = epoch;
  }

  /**
   * Атомарный снимок: версия и тело читаются вместе.
   * Если читать их по отдельности (а между чтениями подождать, например, ?delay),
   * то при работающем тикере ETag и тело разъедутся.
   */
  snapshot(): OrgSnapshot {
    return {
      epoch: this.#epoch,
      version: this.#version,
      nodes: this.#nodes.map((node) => ({ ...node })),
    };
  }

  get revision(): Revision {
    return { epoch: this.#epoch, version: this.#version };
  }

  get size(): number {
    return this.#nodes.length;
  }

  /**
   * Применяет изменения метрик и поднимает версию на единицу — один патч это одна версия,
   * поэтому клиент может отличить пропуск от дубликата.
   * Изменения, не относящиеся к известным узлам, отбрасываются.
   */
  mutate(changes: NodeChange[]): ({ changes: NodeChange[] } & Revision) | null {
    const applied: NodeChange[] = [];

    for (const change of changes) {
      const index = this.#nodes.findIndex((node) => node.id === change.id);
      const current = this.#nodes[index];
      if (!current) continue;

      const next: OrgNode = {
        ...current,
        updatedAt: change.updatedAt,
        ...(change.headcount === undefined ? {} : { headcount: change.headcount }),
        ...(change.budget === undefined ? {} : { budget: change.budget }),
        ...(change.performance === undefined ? {} : { performance: change.performance }),
      };

      this.#nodes[index] = next;
      applied.push(change);
    }

    if (applied.length === 0) return null;

    this.#version += 1;
    const patch = { changes: applied, epoch: this.#epoch, version: this.#version };

    for (const listener of this.#listeners) listener(patch);

    return patch;
  }

  subscribe(listener: StoreListener): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  /** Идентификаторы для тикера: копия, а не внутренний массив. */
  ids(): string[] {
    return this.#nodes.map((node) => node.id);
  }

  get(id: string): OrgNode | undefined {
    const node = this.#nodes.find((item) => item.id === id);
    return node ? { ...node } : undefined;
  }
}
