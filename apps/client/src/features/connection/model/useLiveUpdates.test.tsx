import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { OrgNode, ServerMessage } from '@org/contracts';

import { buildModel, ORG_TREE_KEY, type OrgModel } from '@/entities/org';

import { useLiveUpdates } from './useLiveUpdates';

/** Ловим колбэки соединения, не поднимая настоящий сокет. */
const live = vi.hoisted(() => ({
  onMessage: undefined as ((message: ServerMessage) => void) | undefined,
  dispose: vi.fn(),
  retryNow: vi.fn(),
}));

vi.mock('./createLiveConnection', () => ({
  createLiveConnection: (options: {
    onMessage: (message: ServerMessage) => void;
    onStatus: (state: unknown) => void;
  }) => {
    live.onMessage = options.onMessage;
    options.onStatus({ status: 'open', attempt: 0, retryAt: null });
    return { getState: () => ({}), retryNow: live.retryNow, dispose: live.dispose };
  },
}));

const node = (id: string, parentId: string | null, headcount: number): OrgNode => ({
  id,
  name: id,
  parentId,
  headcount,
  budget: 1_000_000,
  performance: 50,
  updatedAt: '2026-09-18T09:00:00.000Z',
});

const nodes = [node('div', null, 4), node('team', 'div', 10)];

let queryClient: QueryClient;
let invalidate: ReturnType<typeof vi.spyOn>;

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(QueryClientProvider, { client: queryClient }, children);

const seedModel = (version: number, epoch = 'e1'): OrgModel => {
  const model = buildModel(nodes, { epoch, version });
  queryClient.setQueryData(ORG_TREE_KEY, model);
  return model;
};

const send = (message: ServerMessage): void => {
  act(() => {
    live.onMessage?.(message);
  });
};

const modelInCache = (): OrgModel | undefined => queryClient.getQueryData<OrgModel>(ORG_TREE_KEY);

const patch = (version: number, headcount: number, epoch = 'e1'): ServerMessage => ({
  type: 'patch',
  epoch,
  version,
  changes: [{ id: 'team', updatedAt: '2026-09-18T10:00:00.000Z', headcount }],
});

beforeEach(() => {
  queryClient = new QueryClient();
  invalidate = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined);
  live.onMessage = undefined;
});

afterEach(() => {
  queryClient.clear();
  vi.restoreAllMocks();
});

describe('useLiveUpdates', () => {
  it('применяет патч следующей версии без рефетча', () => {
    const before = seedModel(1);
    renderHook(() => useLiveUpdates(), { wrapper });

    send(patch(2, 12));

    expect(modelInCache()?.byId.get('team')?.headcount).toBe(12);
    expect(modelInCache()?.aggregates.get('div')?.headcount).toBe(16);
    expect(modelInCache()).not.toBe(before);
    expect(invalidate).not.toHaveBeenCalled();
  });

  it('игнорирует дубликат и уже учтённые версии', () => {
    const before = seedModel(5);
    renderHook(() => useLiveUpdates(), { wrapper });

    send(patch(5, 99));
    send(patch(4, 99));

    expect(modelInCache()).toBe(before);
    expect(invalidate).not.toHaveBeenCalled();
  });

  it('при разрыве версий перезапрашивает снимок, а не применяет патч', () => {
    seedModel(1);
    renderHook(() => useLiveUpdates(), { wrapper });

    send(patch(7, 99));

    expect(modelInCache()?.byId.get('team')?.headcount).toBe(10);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ORG_TREE_KEY }, { cancelRefetch: false });
  });

  it('рестарт сервера с совпавшим номером версии не применяет патч: эпохи несравнимы', () => {
    seedModel(1, 'старая');
    renderHook(() => useLiveUpdates(), { wrapper });

    send(patch(2, 99, 'новая'));

    expect(modelInCache()?.byId.get('team')?.headcount).toBe(10);
    expect(invalidate).toHaveBeenCalledTimes(1);
  });

  it('hello с той же ревизией ничего не делает', () => {
    seedModel(3);
    renderHook(() => useLiveUpdates(), { wrapper });

    send({ type: 'hello', epoch: 'e1', version: 3 });

    expect(invalidate).not.toHaveBeenCalled();
  });

  it('hello с другой ревизией вызывает рефетч', () => {
    seedModel(3);
    renderHook(() => useLiveUpdates(), { wrapper });

    send({ type: 'hello', epoch: 'e1', version: 8 });

    expect(invalidate).toHaveBeenCalledTimes(1);
  });

  it('reset всегда ведёт к рефетчу', () => {
    seedModel(3);
    renderHook(() => useLiveUpdates(), { wrapper });

    send({ type: 'reset', epoch: 'e1', version: 4 });

    expect(invalidate).toHaveBeenCalledTimes(1);
  });

  it('пока модели нет, сообщения игнорируются — иначе холодный старт давал бы лишний запрос', () => {
    renderHook(() => useLiveUpdates(), { wrapper });

    send({ type: 'hello', epoch: 'e1', version: 0 });
    send(patch(1, 12));

    expect(invalidate).not.toHaveBeenCalled();
  });

  it('патч на неизвестный узел не пишет null в кэш, а ведёт к рефетчу', () => {
    const before = seedModel(1);
    renderHook(() => useLiveUpdates(), { wrapper });

    send({
      type: 'patch',
      epoch: 'e1',
      version: 2,
      changes: [{ id: 'нет-такого', updatedAt: '2026-09-18T10:00:00.000Z', headcount: 1 }],
    });

    expect(modelInCache()).toBe(before);
    expect(invalidate).toHaveBeenCalledTimes(1);
  });

  it('при неизвестной ревизии модели патчи не применяются', () => {
    const model = buildModel(nodes, null);
    queryClient.setQueryData(ORG_TREE_KEY, model);
    renderHook(() => useLiveUpdates(), { wrapper });

    send(patch(1, 12));

    expect(modelInCache()).toBe(model);
    expect(invalidate).toHaveBeenCalledTimes(1);
  });

  it('размонтирование закрывает соединение', () => {
    const { unmount } = renderHook(() => useLiveUpdates(), { wrapper });

    unmount();

    expect(live.dispose).toHaveBeenCalled();
  });
});
