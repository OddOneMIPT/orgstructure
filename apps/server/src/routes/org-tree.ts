import { formatRevision, type OrgNode } from '@org/contracts';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import type { Env } from '../env.js';
import type { OrgStore } from '../store.js';

/**
 * Отладочные параметры — только при MOCK_DEBUG=1. Нужны, чтобы показать состояния
 * загрузки/ошибки/пустого ответа и отмену запроса, не ломая обычный режим.
 */
const DebugQuerySchema = z.object({
  delay: z.coerce.number().int().min(0).max(30_000).optional(),
  fail: z.coerce.boolean().optional(),
  empty: z.coerce.boolean().optional(),
  invalid: z.coerce.boolean().optional(),
});

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** `If-None-Match` может приехать слабым, если его переписал прокси. */
const etagMatches = (header: string | undefined, etag: string): boolean => {
  if (!header) return false;
  return header
    .split(',')
    .some((candidate) => candidate.trim().replace(/^W\//, '') === etag.replace(/^W\//, ''));
};

export interface OrgTreeRouteOptions {
  store: OrgStore;
  env: Env;
}

export function registerOrgTreeRoute(
  app: FastifyInstance,
  { store, env }: OrgTreeRouteOptions,
): void {
  app.get('/api/org-tree', async (request, reply) => {
    const debug = env.MOCK_DEBUG ? DebugQuerySchema.parse(request.query) : {};

    if (debug.delay) {
      await sleep(debug.delay);
    }

    if (debug.fail) {
      return reply.code(500).send({ message: 'Отладочный сбой (?fail=1)' });
    }

    // Снимок читается ПОСЛЕ задержки: иначе заголовок с версией уехал бы раньше тела.
    const snapshot = store.snapshot();
    const etag = formatRevision(snapshot);

    if (etagMatches(request.headers['if-none-match'], etag)) {
      return reply.code(304).header('ETag', etag).header('Cache-Control', 'no-cache').send();
    }

    reply.header('ETag', etag).header('Cache-Control', 'no-cache');

    if (debug.empty) {
      return reply.send([]);
    }

    if (debug.invalid) {
      // Нарушает схему: performance вне диапазона и лишнее поле.
      const [first] = snapshot.nodes;
      const broken = { ...first, performance: 1000, unexpected: true } as unknown as OrgNode;
      return reply.send([broken, ...snapshot.nodes.slice(1)]);
    }

    return reply.send(snapshot.nodes);
  });
}
