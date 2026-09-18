import websocket from '@fastify/websocket';
import Fastify, { type FastifyInstance } from 'fastify';

import { type Env, env as processEnv } from './env.js';
import { registerLiveRoute } from './routes/live.js';
import { registerOrgTreeRoute } from './routes/org-tree.js';
import { registerSearchRoute } from './routes/search.js';
import { OrgStore } from './store.js';
import { createTicker, type Ticker } from './ticker.js';

export interface BuildServerOptions {
  env?: Env;
  store?: OrgStore;
  logger?: boolean;
  /** Тикер по умолчанию берётся из env; в тестах его удобно выключить. */
  ticker?: Ticker | null;
}

export async function buildServer(options: BuildServerOptions = {}): Promise<FastifyInstance> {
  const { env = processEnv, store = new OrgStore(), logger = true } = options;

  const app = Fastify({ logger });
  await app.register(websocket);

  app.get('/api/health', () => ({ status: 'ok', nodes: store.size, ...store.revision }));
  registerOrgTreeRoute(app, { store, env });
  registerLiveRoute(app, { store });
  registerSearchRoute(app, { env });

  if (env.MOCK_DEBUG) {
    // Демонстрация обрыва соединения и экспоненциального backoff на клиенте.
    app.post('/api/debug/drop-connections', () => ({ dropped: app.dropLiveConnections() }));
  }

  const ticker =
    options.ticker === undefined
      ? createTicker({ store, intervalMs: env.TICK_INTERVAL_MS })
      : options.ticker;

  ticker?.start();
  app.addHook('onClose', () => {
    ticker?.stop();
  });

  await app.ready();
  return app;
}
