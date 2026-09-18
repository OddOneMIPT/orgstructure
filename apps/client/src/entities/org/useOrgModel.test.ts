import type { OrgNode } from '@org/contracts';
import { QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';

import { fetchOrgTree, type OrgTreeFetchResult } from '@/shared/api';

import { buildModel } from './buildModel';
import { ORG_TREE_KEY, loadOrgModel, useOrgModel } from './useOrgModel';

vi.mock('@/shared/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/api')>();
  return { ...actual, fetchOrgTree: vi.fn() };
});

const fetchOrgTreeMock = vi.mocked(fetchOrgTree);

const node = (id: string, parentId: string | null, headcount = 10): OrgNode => ({
  id,
  name: id,
  parentId,
  headcount,
  budget: 1_000_000,
  performance: 70,
  updatedAt: '2026-09-18T09:00:00.000Z',
});

const nodes = [node('div', null), node('team', 'div')];

const ok = (version: number, epoch = 'e1', payload = nodes): OrgTreeFetchResult => ({
  status: 'ok',
  nodes: payload,
  revision: { epoch, version },
});

let queryClient: QueryClient;

beforeEach(() => {
  queryClient = new QueryClient();
  fetchOrgTreeMock.mockReset();
});

afterEach(() => {
  queryClient.clear();
});

describe('loadOrgModel', () => {
  it('строит модель из ответа', async () => {
    fetchOrgTreeMock.mockResolvedValue(ok(1));

    const model = await loadOrgModel(queryClient, undefined);

    expect(model.byId.size).toBe(2);
    expect(model.revision).toEqual({ epoch: 'e1', version: 1 });
  });

  it('при 304 возвращает модель из кэша, не запрашивая тело повторно', async () => {
    const cached = buildModel(nodes, { epoch: 'e1', version: 1 });
    queryClient.setQueryData(ORG_TREE_KEY, cached);
    fetchOrgTreeMock.mockResolvedValue({ status: 'unchanged' });

    const model = await loadOrgModel(queryClient, undefined);

    expect(model).toBe(cached);
    expect(fetchOrgTreeMock).toHaveBeenCalledTimes(1);
  });

  it('при 304 без кэша перезапрашивает тело мимо кэша браузера', async () => {
    fetchOrgTreeMock.mockResolvedValueOnce({ status: 'unchanged' }).mockResolvedValueOnce(ok(3));

    const model = await loadOrgModel(queryClient, undefined);

    expect(model.byId.size).toBe(2);
    expect(fetchOrgTreeMock).toHaveBeenLastCalledWith(expect.objectContaining({ cache: 'reload' }));
  });

  it('та же ревизия возвращает ту же ссылку — ревалидация не плодит объекты', async () => {
    fetchOrgTreeMock.mockResolvedValue(ok(4));

    const first = await loadOrgModel(queryClient, undefined);
    queryClient.setQueryData(ORG_TREE_KEY, first);
    const second = await loadOrgModel(queryClient, undefined);

    expect(second).toBe(first);
  });

  it('ответ со старой версией не откатывает применённые патчи', async () => {
    const ahead = buildModel(nodes, { epoch: 'e1', version: 12 });
    queryClient.setQueryData(ORG_TREE_KEY, ahead);
    fetchOrgTreeMock.mockResolvedValue(ok(10));

    expect(await loadOrgModel(queryClient, undefined)).toBe(ahead);
  });

  it('старая версия из другой эпохи применяется: эпохи несравнимы', async () => {
    const ahead = buildModel(nodes, { epoch: 'старая', version: 12 });
    queryClient.setQueryData(ORG_TREE_KEY, ahead);
    fetchOrgTreeMock.mockResolvedValue(ok(1, 'новая'));

    const model = await loadOrgModel(queryClient, undefined);

    expect(model).not.toBe(ahead);
    expect(model.revision).toEqual({ epoch: 'новая', version: 1 });
  });

  it('более свежая версия применяется', async () => {
    const before = buildModel(nodes, { epoch: 'e1', version: 1 });
    queryClient.setQueryData(ORG_TREE_KEY, before);
    fetchOrgTreeMock.mockResolvedValue(ok(2, 'e1', [node('div', null), node('team', 'div', 42)]));

    const model = await loadOrgModel(queryClient, undefined);

    expect(model.byId.get('team')?.headcount).toBe(42);
    expect(model.byId.get('div')).toBe(before.byId.get('div'));
  });

  it('ошибка запроса пробрасывается наверх', async () => {
    fetchOrgTreeMock.mockRejectedValue(new Error('сеть'));

    await expect(loadOrgModel(queryClient, undefined)).rejects.toThrow('сеть');
  });
});

describe('useOrgModel', () => {
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);

  it('не повторяет запрос при новом монтировании в пределах stale time', async () => {
    fetchOrgTreeMock.mockResolvedValue(ok(1));

    const first = renderHook(() => useOrgModel(), { wrapper });
    await waitFor(() => {
      expect(first.result.current.data).toBeDefined();
    });
    first.unmount();

    const second = renderHook(() => useOrgModel(), { wrapper });
    await waitFor(() => {
      expect(second.result.current.data).toBeDefined();
    });

    expect(fetchOrgTreeMock).toHaveBeenCalledTimes(1);
  });

  it('после истечения stale time ревалидирует, но при той же ревизии отдаёт прежнюю модель', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    fetchOrgTreeMock.mockResolvedValue(ok(1));

    const first = renderHook(() => useOrgModel(), { wrapper });
    await waitFor(() => {
      expect(first.result.current.data).toBeDefined();
    });
    const model = first.result.current.data;
    first.unmount();

    vi.advanceTimersByTime(6_000);

    const second = renderHook(() => useOrgModel(), { wrapper });
    await waitFor(() => {
      expect(fetchOrgTreeMock).toHaveBeenCalledTimes(2);
    });

    expect(second.result.current.data).toBe(model);
    vi.useRealTimers();
  });
});
