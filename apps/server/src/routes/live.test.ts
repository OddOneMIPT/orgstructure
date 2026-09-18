import { parseServerMessage, type OrgNode, type ServerMessage } from '@org/contracts';
import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';

import { buildServer } from '../app.js';
import { parseEnv } from '../env.js';
import { OrgStore } from '../store.js';

const node = (id: string): OrgNode => ({
  id,
  name: `Узел ${id}`,
  parentId: null,
  headcount: 10,
  budget: 1_000_000,
  performance: 50,
  updatedAt: '2026-09-18T09:00:00.000Z',
});

let app: FastifyInstance | undefined;

const start = async (store: OrgStore, envSource: NodeJS.ProcessEnv = {}) => {
  app = await buildServer({ env: parseEnv(envSource), store, logger: false, ticker: null });
  await app.listen({ port: 0, host: '127.0.0.1' });

  const address = app.server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  return `ws://127.0.0.1:${port}/ws`;
};

/**
 * Сокет с буфером сообщений: `hello` уходит сразу при подключении, и слушатель,
 * повешенный после `open`, его уже не застаёт.
 */
function connect(url: string): {
  socket: WebSocket;
  waitFor: (type: ServerMessage['type']) => Promise<ServerMessage>;
} {
  const socket = new WebSocket(url);
  const received: ServerMessage[] = [];
  const waiters: { type: ServerMessage['type']; resolve: (message: ServerMessage) => void }[] = [];

  socket.on('message', (raw: Buffer) => {
    const message = parseServerMessage(raw.toString('utf8'));
    if (!message) return;

    received.push(message);
    const index = waiters.findIndex((waiter) => waiter.type === message.type);
    const waiter = waiters[index];
    if (waiter) {
      waiters.splice(index, 1);
      waiter.resolve(message);
    }
  });

  return {
    socket,
    waitFor: (type) =>
      new Promise((resolve, reject) => {
        const buffered = received.findIndex((message) => message.type === type);
        if (buffered !== -1) {
          resolve(received.splice(buffered, 1)[0]!);
          return;
        }

        const timer = setTimeout(() => {
          reject(new Error(`Не дождались сообщения ${type}`));
        }, 2_000);

        waiters.push({
          type,
          resolve: (message) => {
            clearTimeout(timer);
            resolve(message);
          },
        });
      }),
  };
}

afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe('GET /ws', () => {
  it('сразу присылает hello с текущей ревизией', async () => {
    const store = new OrgStore([node('a')], 'epoch-1');
    const { socket, waitFor } = connect(await start(store));

    const hello = await waitFor('hello');

    expect(hello).toEqual({ type: 'hello', epoch: 'epoch-1', version: 0 });
    socket.close();
  });

  it('рассылает патч при мутации стора', async () => {
    const store = new OrgStore([node('a')], 'epoch-1');
    const { socket, waitFor } = connect(await start(store));
    await waitFor('hello');

    const patchPromise = waitFor('patch');
    store.mutate([{ id: 'a', updatedAt: '2026-09-18T10:00:00.000Z', headcount: 12 }]);

    expect(await patchPromise).toEqual({
      type: 'patch',
      epoch: 'epoch-1',
      version: 1,
      changes: [{ id: 'a', updatedAt: '2026-09-18T10:00:00.000Z', headcount: 12 }],
    });
    socket.close();
  });

  it('патч доходит до всех подключённых клиентов', async () => {
    const store = new OrgStore([node('a')], 'epoch-1');
    const url = await start(store);
    const first = connect(url);
    const second = connect(url);
    await Promise.all([first.waitFor('hello'), second.waitFor('hello')]);

    const patches = Promise.all([first.waitFor('patch'), second.waitFor('patch')]);
    store.mutate([{ id: 'a', updatedAt: '2026-09-18T10:00:00.000Z', budget: 42 }]);

    const [a, b] = await patches;
    expect(a).toEqual(b);

    first.socket.close();
    second.socket.close();
  });

  it('шлёт heartbeat', async () => {
    const store = new OrgStore([node('a')], 'epoch-1');
    app = await buildServer({
      env: parseEnv({}),
      store,
      logger: false,
      ticker: null,
    });
    // Интервал по умолчанию 15 с — для теста поднимаем отдельный сервер с коротким.
    await app.close();

    const { registerLiveRoute } = await import('./live.js');
    const Fastify = (await import('fastify')).default;
    const websocket = (await import('@fastify/websocket')).default;

    const server = Fastify({ logger: false });
    await server.register(websocket);
    registerLiveRoute(server, { store, pingIntervalMs: 20 });
    await server.listen({ port: 0, host: '127.0.0.1' });

    const address = server.server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    const { socket, waitFor } = connect(`ws://127.0.0.1:${port}/ws`);

    expect(await waitFor('ping')).toEqual({ type: 'ping' });

    socket.close();
    await server.close();
    app = undefined;
  });

  it('dropLiveConnections закрывает соединения — так демонстрируется backoff', async () => {
    const store = new OrgStore([node('a')], 'epoch-1');
    const url = await start(store, { MOCK_DEBUG: '1' });
    const { socket, waitFor } = connect(url);
    await waitFor('hello');

    const closed = new Promise<number>((resolve) => {
      socket.on('close', (code) => {
        resolve(code);
      });
    });

    const response = await app!.inject({ method: 'POST', url: '/api/debug/drop-connections' });

    expect(response.json()).toEqual({ dropped: 1 });
    await closed;
  });

  it('отладочный маршрут закрыт без MOCK_DEBUG', async () => {
    const store = new OrgStore([node('a')], 'epoch-1');
    await start(store);

    const response = await app!.inject({ method: 'POST', url: '/api/debug/drop-connections' });

    expect(response.statusCode).toBe(404);
  });
});
