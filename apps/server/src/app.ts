import Fastify, { type FastifyInstance } from 'fastify';

import { env as defaultEnv, type Env } from './env.js';

export interface BuildServerOptions {
  env?: Env;
  logger?: boolean;
}

export async function buildServer(options: BuildServerOptions = {}): Promise<FastifyInstance> {
  const { logger = true } = options;

  const app = Fastify({ logger });

  app.get('/api/health', () => ({ status: 'ok' }));

  await app.ready();
  return app;
}

export { defaultEnv };
