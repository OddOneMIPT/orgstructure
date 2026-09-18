import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ServerMessage } from '@org/contracts';

import {
  type ConnectionState,
  createLiveConnection,
  type SocketLike,
} from './createLiveConnection';

/** Фейковый сокет: реальный WebSocket в тестах не нужен и только добавил бы флаки. */
class FakeSocket implements SocketLike {
  static instances: FakeSocket[] = [];

  closed = false;
  #listeners = new Map<string, ((event: never) => void)[]>();

  constructor(readonly url: string) {
    FakeSocket.instances.push(this);
  }

  addEventListener(type: string, listener: (event: never) => void): void {
    const list = this.#listeners.get(type) ?? [];
    list.push(listener);
    this.#listeners.set(type, list);
  }

  close(): void {
    this.closed = true;
  }

  emit(type: string, event?: unknown): void {
    for (const listener of this.#listeners.get(type) ?? []) {
      (listener as (value: unknown) => void)(event);
    }
  }

  open(): void {
    this.emit('open');
  }

  send(message: ServerMessage | string): void {
    this.emit('message', { data: typeof message === 'string' ? message : JSON.stringify(message) });
  }

  static get last(): FakeSocket {
    return FakeSocket.instances.at(-1)!;
  }
}

const hello = (version = 0): ServerMessage => ({ type: 'hello', epoch: 'e1', version });

interface Harness {
  messages: ServerMessage[];
  states: ConnectionState[];
  connection: ReturnType<typeof createLiveConnection>;
}

const setup = (overrides: Partial<Parameters<typeof createLiveConnection>[0]> = {}): Harness => {
  const messages: ServerMessage[] = [];
  const states: ConnectionState[] = [];

  const connection = createLiveConnection({
    url: 'ws://test/ws',
    onMessage: (message) => messages.push(message),
    onStatus: (state) => states.push({ ...state }),
    createSocket: (url) => new FakeSocket(url),
    random: () => 1, // максимальная задержка — её удобно отсчитывать таймерами
    baseMs: 1_000,
    capMs: 30_000,
    ...overrides,
  });

  return { messages, states, connection };
};

beforeEach(() => {
  vi.useFakeTimers();
  FakeSocket.instances = [];
});

afterEach(() => {
  vi.useRealTimers();
});

describe('createLiveConnection', () => {
  it('подключается сразу и сообщает статус', () => {
    const { states, connection } = setup();

    expect(FakeSocket.instances).toHaveLength(1);
    expect(states[0]?.status).toBe('connecting');

    FakeSocket.last.open();
    expect(states.at(-1)?.status).toBe('open');

    connection.dispose();
  });

  it('прокидывает сообщения наверх, кроме ping', () => {
    const { messages, connection } = setup();
    FakeSocket.last.open();

    FakeSocket.last.send(hello(3));
    FakeSocket.last.send({ type: 'ping' });

    expect(messages).toEqual([hello(3)]);
    connection.dispose();
  });

  it('игнорирует нечитаемый кадр, но после трёх подряд переподключается', () => {
    const { messages, connection } = setup();
    FakeSocket.last.open();

    FakeSocket.last.send('не json');
    FakeSocket.last.send('{"type":"нет такого"}');
    expect(messages).toEqual([]);
    expect(FakeSocket.instances).toHaveLength(1);

    FakeSocket.last.send('тоже мусор');
    vi.advanceTimersByTime(1_000);

    expect(FakeSocket.instances).toHaveLength(2);
    connection.dispose();
  });

  it('после обрыва переподключается с экспоненциальной задержкой', () => {
    const { connection } = setup();

    FakeSocket.last.open();
    FakeSocket.last.emit('close');

    // Первая попытка — через base.
    vi.advanceTimersByTime(999);
    expect(FakeSocket.instances).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(FakeSocket.instances).toHaveLength(2);

    // Вторая — через 2 · base.
    FakeSocket.last.emit('close');
    vi.advanceTimersByTime(1_999);
    expect(FakeSocket.instances).toHaveLength(2);
    vi.advanceTimersByTime(1);
    expect(FakeSocket.instances).toHaveLength(3);

    connection.dispose();
  });

  it('задержка не превышает потолок', () => {
    const { states, connection } = setup({ capMs: 4_000 });

    for (let i = 0; i < 8; i += 1) {
      FakeSocket.last.open();
      FakeSocket.last.emit('close');
      vi.advanceTimersByTime(4_000);
    }

    const scheduled = states.filter((state) => state.retryAt !== null);
    expect(scheduled.length).toBeGreaterThan(0);
    connection.dispose();
  });

  it('счётчик попыток сбрасывается только после устойчивого соединения', () => {
    let clock = 0;
    const { states, connection } = setup({ now: () => clock, stableAfterMs: 5_000 });

    FakeSocket.last.open();
    FakeSocket.last.emit('close');
    vi.advanceTimersByTime(1_000);
    expect(states.at(-1)?.attempt).toBe(1);

    // Подключились и сразу получили сообщение — «прожило» меньше порога.
    FakeSocket.last.open();
    FakeSocket.last.send(hello(1));
    expect(states.at(-1)?.attempt).toBe(1);

    // А теперь соединение живёт дольше порога.
    clock += 6_000;
    FakeSocket.last.send(hello(2));
    expect(states.at(-1)?.attempt).toBe(0);

    connection.dispose();
  });

  it('молчание дольше heartbeat-таймаута считается обрывом', () => {
    const { connection } = setup({ heartbeatTimeoutMs: 1_000 });
    FakeSocket.last.open();

    vi.advanceTimersByTime(1_000);
    expect(FakeSocket.instances[0]?.closed).toBe(true);

    vi.advanceTimersByTime(1_000);
    expect(FakeSocket.instances).toHaveLength(2);

    connection.dispose();
  });

  it('ping продлевает жизнь соединения', () => {
    const { connection } = setup({ heartbeatTimeoutMs: 1_000 });
    FakeSocket.last.open();

    vi.advanceTimersByTime(900);
    FakeSocket.last.send({ type: 'ping' });
    vi.advanceTimersByTime(900);

    expect(FakeSocket.instances[0]?.closed).toBe(false);
    connection.dispose();
  });

  it('«Подключиться сейчас» не ждёт таймера', () => {
    const { connection } = setup();
    FakeSocket.last.open();
    FakeSocket.last.emit('close');

    connection.retryNow();

    expect(FakeSocket.instances).toHaveLength(2);
    connection.dispose();
  });

  it('dispose закрывает сокет и останавливает таймеры', () => {
    const { connection } = setup();
    FakeSocket.last.open();

    connection.dispose();
    FakeSocket.last.emit('close');
    vi.advanceTimersByTime(60_000);

    expect(FakeSocket.instances).toHaveLength(1);
    expect(FakeSocket.instances[0]?.closed).toBe(true);
  });

  it('сообщения из закрытого сокета игнорируются', () => {
    const { messages, connection } = setup();
    const first = FakeSocket.last;

    first.open();
    first.emit('close');
    vi.advanceTimersByTime(1_000);

    first.send(hello(9));

    expect(messages).toEqual([]);
    connection.dispose();
  });
});
