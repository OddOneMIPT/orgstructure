import { randomUUID } from 'node:crypto';

import type { OrgNode, Revision } from '@org/contracts';

import { createSeedNodes } from './seed.js';

export interface OrgSnapshot extends Revision {
  nodes: OrgNode[];
}

/**
 * Состояние живёт в памяти. Наружу отдаются только копии: внутренний массив не должен
 * утекать, иначе вызывающий код сможет менять данные в обход версии.
 */
export class OrgStore {
  #nodes: OrgNode[];
  #epoch: string;
  #version = 0;

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
}
