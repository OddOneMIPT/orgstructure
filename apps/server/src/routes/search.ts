import type { FastifyInstance } from 'fastify';

import { SearchParseRequestSchema } from '@org/contracts';

import { parseSearchQuery } from '../ai/parseSearchQuery.js';
import type { Env } from '../env.js';

export interface SearchRouteOptions {
  env: Env;
  now?: () => number;
}

/** Ведро на процесс: ключ один, и защищать надо именно его, а не отдельного клиента. */
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60_000;

interface Bucket {
  tokens: number;
  filledAt: number;
}

/**
 * Разбор естественно-языкового запроса. Живёт на сервере, потому что ключ AI
 * не должен попадать в клиентский бандл (ADR 007).
 */
export function registerSearchRoute(
  app: FastifyInstance,
  { env, now = Date.now }: SearchRouteOptions,
): void {
  const bucket: Bucket = { tokens: RATE_LIMIT, filledAt: now() };

  const allow = (): boolean => {
    const moment = now();
    const restored = ((moment - bucket.filledAt) / RATE_WINDOW_MS) * RATE_LIMIT;

    if (restored > 0) {
      bucket.tokens = Math.min(RATE_LIMIT, bucket.tokens + restored);
      bucket.filledAt = moment;
    }

    if (bucket.tokens < 1) return false;

    bucket.tokens -= 1;
    return true;
  };

  app.post('/api/search/parse', async (request, reply) => {
    const body = SearchParseRequestSchema.safeParse(request.body);

    if (!body.success) {
      return reply.code(400).send({ message: 'Ожидается { query: string }' });
    }

    // Превышение лимита — это тоже fallback, а не ошибка: поиск обязан
    // продолжать работать, а причина видна пользователю строкой (ADR 007).
    if (!allow()) {
      return reply.send({
        source: 'fallback',
        filter: null,
        reason: 'Слишком много запросов к AI-поиску подряд — попробуйте через минуту',
      });
    }

    return reply.send(await parseSearchQuery({ env, query: body.data.query }));
  });
}
