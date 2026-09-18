import type { FastifyInstance } from 'fastify';

import type { ServerMessage } from '@org/contracts';

import type { OrgStore } from '../store.js';

/** Клиент считает соединение мёртвым, если молчит дольше 35 с (ADR 004). */
const PING_INTERVAL_MS = 15_000;

export interface LiveRouteOptions {
  store: OrgStore;
  pingIntervalMs?: number;
}

/**
 * Поток обновлений. Отдельный не-WS маршрут `GET /ws` не регистрируется: это был бы
 * дубль маршрута. Апгрейд по неизвестному пути виден клиенту как мгновенный `close`
 * без ошибки, поэтому такие попытки логируются на сервере.
 */
export function registerLiveRoute(
  app: FastifyInstance,
  { store, pingIntervalMs = PING_INTERVAL_MS }: LiveRouteOptions,
): void {
  const sockets = new Set<{ send: (data: string) => void; close: () => void }>();

  const send = (socket: { send: (data: string) => void }, message: ServerMessage): void => {
    socket.send(JSON.stringify(message));
  };

  const unsubscribe = store.subscribe((patch) => {
    const message: ServerMessage = { type: 'patch', ...patch };
    for (const socket of sockets) send(socket, message);
  });

  const heartbeat = setInterval(() => {
    for (const socket of sockets) send(socket, { type: 'ping' });
  }, pingIntervalMs);
  heartbeat.unref?.();

  app.get('/ws', { websocket: true }, (socket) => {
    sockets.add(socket);

    // Первое сообщение — ревизия: клиент сразу понимает, актуален ли его снимок.
    send(socket, { type: 'hello', ...store.revision });

    socket.on('close', () => {
      sockets.delete(socket);
    });
    socket.on('error', () => {
      sockets.delete(socket);
    });
  });

  /** Для демонстрации обрыва и backoff. */
  app.decorate('dropLiveConnections', () => {
    const count = sockets.size;
    for (const socket of sockets) socket.close();
    sockets.clear();
    return count;
  });

  app.addHook('onClose', () => {
    clearInterval(heartbeat);
    unsubscribe();
    for (const socket of sockets) socket.close();
    sockets.clear();
  });
}

declare module 'fastify' {
  interface FastifyInstance {
    dropLiveConnections: () => number;
  }
}
