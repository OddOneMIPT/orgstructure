import { parseServerMessage, type ServerMessage } from '@org/contracts';

import { DEFAULT_BACKOFF, nextDelay } from '@/shared/lib/backoff';

export type ConnectionStatus = 'connecting' | 'open' | 'reconnecting' | 'offline';

export interface ConnectionState {
  status: ConnectionStatus;
  /** Сколько попыток подряд закончились неудачей. */
  attempt: number;
  /** Когда запланирована следующая попытка (timestamp), если она запланирована. */
  retryAt: number | null;
}

/** Минимальный контракт сокета — чтобы в тестах подставлять свой. */
export interface SocketLike {
  addEventListener: (type: string, listener: (event: never) => void) => void;
  close: () => void;
}

export interface LiveConnectionOptions {
  url: string;
  onMessage: (message: ServerMessage) => void;
  onStatus: (state: ConnectionState) => void;
  /** Фабрика вместо подмены глобала: WebSocket есть и в jsdom, и в Node. */
  createSocket?: (url: string) => SocketLike;
  baseMs?: number;
  capMs?: number;
  random?: () => number;
  /** Нет ни одного сообщения (включая ping) — считаем соединение мёртвым. */
  heartbeatTimeoutMs?: number;
  /** Соединение прожило столько — счётчик попыток сбрасывается. */
  stableAfterMs?: number;
  now?: () => number;
}

const HEARTBEAT_TIMEOUT_MS = 35_000;
const STABLE_AFTER_MS = 5_000;
/** Подряд идущие нечитаемые кадры означают, что говорить нам не о чем. */
const MAX_INVALID_MESSAGES = 3;

/**
 * Живое соединение с сервером: автомат `connecting → open → reconnecting`,
 * экспоненциальный backoff с джиттером, heartbeat-таймаут и реакция на online/offline.
 *
 * Своё вместо socket.io/reconnecting-websocket: задание просит показать именно эту
 * логику, а её здесь на сотню строк (ADR 004).
 */
export function createLiveConnection(options: LiveConnectionOptions) {
  const {
    url,
    onMessage,
    onStatus,
    createSocket = (target) => new WebSocket(target) as unknown as SocketLike,
    baseMs = DEFAULT_BACKOFF.baseMs,
    capMs = DEFAULT_BACKOFF.capMs,
    random = Math.random,
    heartbeatTimeoutMs = HEARTBEAT_TIMEOUT_MS,
    stableAfterMs = STABLE_AFTER_MS,
    now = () => Date.now(),
  } = options;

  let socket: SocketLike | null = null;
  let attempt = 0;
  let invalidInARow = 0;
  let openedAt = 0;
  let disposed = false;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let heartbeatTimer: ReturnType<typeof setTimeout> | undefined;
  let state: ConnectionState = { status: 'connecting', attempt: 0, retryAt: null };

  const emit = (next: Partial<ConnectionState>): void => {
    state = { ...state, ...next };
    onStatus(state);
  };

  const clearTimers = (): void => {
    clearTimeout(retryTimer);
    clearTimeout(heartbeatTimer);
    retryTimer = undefined;
    heartbeatTimer = undefined;
  };

  const armHeartbeat = (): void => {
    clearTimeout(heartbeatTimer);
    heartbeatTimer = setTimeout(() => {
      // Сокет может «висеть» открытым, не присылая ничего: закрываем сами.
      closeSocket();
      scheduleRetry();
    }, heartbeatTimeoutMs);
  };

  const closeSocket = (): void => {
    if (!socket) return;
    const current = socket;
    socket = null;
    try {
      current.close();
    } catch {
      // Закрытие уже закрытого сокета — не ошибка.
    }
  };

  const scheduleRetry = (): void => {
    if (disposed) return;

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      // Браузер точно знает, что сети нет: ждём события online, а не таймера.
      emit({ status: 'offline', retryAt: null });
      return;
    }

    const delay = nextDelay(attempt, { baseMs, capMs, random });
    attempt += 1;

    emit({ status: 'reconnecting', attempt, retryAt: now() + delay });

    retryTimer = setTimeout(connect, delay);
  };

  function connect(): void {
    if (disposed) return;

    clearTimers();
    emit({ status: state.attempt === 0 ? 'connecting' : 'reconnecting', retryAt: null });

    const current = createSocket(url);
    socket = current;

    current.addEventListener('open', () => {
      if (socket !== current) return;

      openedAt = now();
      invalidInARow = 0;
      emit({ status: 'open', retryAt: null });
      armHeartbeat();
    });

    current.addEventListener('message', (event: MessageEvent<string>) => {
      if (socket !== current) return;

      armHeartbeat();

      const message = parseServerMessage(event.data);
      if (!message) {
        invalidInARow += 1;
        if (invalidInARow >= MAX_INVALID_MESSAGES) {
          invalidInARow = 0;
          closeSocket();
          scheduleRetry();
        }
        return;
      }

      invalidInARow = 0;

      /**
       * Счётчик попыток сбрасывается не по факту подключения, а когда соединение
       * прожило достаточно: иначе цикл «подключился — сразу упал» держал бы
       * задержку на минимуме и долбил сервер.
       */
      if (attempt !== 0 && now() - openedAt >= stableAfterMs) {
        attempt = 0;
        emit({ attempt: 0 });
      }

      if (message.type !== 'ping') onMessage(message);
    });

    const onClosed = (): void => {
      if (socket !== current) return;
      socket = null;
      clearTimeout(heartbeatTimer);
      scheduleRetry();
    };

    current.addEventListener('close', onClosed);
    current.addEventListener('error', onClosed);
  }

  const handleOnline = (): void => {
    if (disposed) return;
    attempt = 0;
    clearTimers();
    connect();
  };

  const handleOffline = (): void => {
    if (disposed) return;
    clearTimers();
    closeSocket();
    emit({ status: 'offline', retryAt: null });
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
  }

  connect();

  return {
    getState: (): ConnectionState => state,
    /** Немедленная попытка по кнопке «Подключиться сейчас». */
    retryNow(): void {
      if (disposed) return;
      attempt = 0;
      clearTimers();
      closeSocket();
      connect();
    },
    dispose(): void {
      disposed = true;
      clearTimers();
      closeSocket();
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      }
    },
  };
}

export type LiveConnection = ReturnType<typeof createLiveConnection>;
