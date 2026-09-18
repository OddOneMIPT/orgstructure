import Fastify, { type FastifyInstance } from 'fastify';

import { env as processEnv, type Env } from './env.js';
import { registerOrgTreeRoute } from './routes/org-tree.js';
import { OrgStore } from './store.js';

export interface BuildServerOptions {
  env?: Env;
  store?: OrgStore;
  logger?: boolean;
}

export async function buildServer(options: BuildServerOptions = {}): Promise<FastifyInstance> {
  const { env = processEnv, store = new OrgStore(), logger = true } = options;

  const app = Fastify({ logger });

  app.get('/api/health', () => ({ status: 'ok', nodes: store.size }));
  registerOrgTreeRoute(app, { store, env });

  await app.ready();
  return app;
}
