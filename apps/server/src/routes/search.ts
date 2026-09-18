import { SearchParseRequestSchema } from '@org/contracts';
import type { FastifyInstance } from 'fastify';

import { parseSearchQuery } from '../ai/parseSearchQuery.js';
import type { Env } from '../env.js';

export interface SearchRouteOptions {
  env: Env;
}

/**
 * Разбор естественно-языкового запроса. Живёт на сервере, потому что ключ AI
 * не должен попадать в клиентский бандл (ADR 007).
 */
export function registerSearchRoute(app: FastifyInstance, { env }: SearchRouteOptions): void {
  app.post('/api/search/parse', async (request, reply) => {
    const body = SearchParseRequestSchema.safeParse(request.body);

    if (!body.success) {
      return reply.code(400).send({ message: 'Ожидается { query: string }' });
    }

    return reply.send(await parseSearchQuery({ env, query: body.data.query }));
  });
}
