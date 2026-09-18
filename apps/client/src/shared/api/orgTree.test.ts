import { afterEach, describe, expect, it, vi } from 'vitest';

import type { OrgNode } from '@org/contracts';

import { HttpError, NetworkError, ValidationError } from './errors';
import { fetchOrgTree } from './orgTree';

const node: OrgNode = {
  id: 'div-1',
  name: 'Технологии',
  parentId: null,
  headcount: 4,
  budget: 9_000_000,
  performance: 90,
  updatedAt: '2026-09-18T09:42:00.000Z',
};

const respond = (body: unknown, init: { status?: number; etag?: string | null } = {}): Response => {
  const headers = new Headers();
  if (init.etag) headers.set('ETag', init.etag);

  return new Response(init.status === 304 ? null : JSON.stringify(body), {
    status: init.status ?? 200,
    headers,
  });
};

const mockFetch = (impl: () => Promise<Response>): void => {
  vi.stubGlobal('fetch', vi.fn(impl));
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchOrgTree', () => {
  it('возвращает узлы и ревизию из ETag', async () => {
    mockFetch(() => Promise.resolve(respond([node], { etag: '"epoch-1.7"' })));

    const result = await fetchOrgTree();

    expect(result).toEqual({
      status: 'ok',
      nodes: [node],
      revision: { epoch: 'epoch-1', version: 7 },
    });
  });

  it('понимает слабый ETag от nginx', async () => {
    mockFetch(() => Promise.resolve(respond([node], { etag: 'W/"epoch-1.7"' })));

    const result = await fetchOrgTree();

    expect(result).toMatchObject({ revision: { epoch: 'epoch-1', version: 7 } });
  });

  it('без ETag ревизия неизвестна — это не ошибка, но патчи потом не применяются', async () => {
    mockFetch(() => Promise.resolve(respond([node], { etag: null })));

    const result = await fetchOrgTree();

    expect(result).toMatchObject({ status: 'ok', revision: null });
  });

  it('304 не превращается в ошибку, хотя у него ok === false', async () => {
    mockFetch(() => Promise.resolve(respond(null, { status: 304, etag: '"epoch-1.7"' })));

    await expect(fetchOrgTree()).resolves.toEqual({ status: 'unchanged' });
  });

  it('пустой массив — валидный ответ', async () => {
    mockFetch(() => Promise.resolve(respond([], { etag: '"epoch-1.0"' })));

    await expect(fetchOrgTree()).resolves.toMatchObject({ status: 'ok', nodes: [] });
  });

  it('5xx даёт HttpError со статусом', async () => {
    mockFetch(() => Promise.resolve(respond({ message: 'no' }, { status: 500 })));

    await expect(fetchOrgTree()).rejects.toBeInstanceOf(HttpError);
    await expect(fetchOrgTree()).rejects.toMatchObject({ status: 500 });
  });

  it('невалидная схема даёт ValidationError с перечнем проблем', async () => {
    mockFetch(() => Promise.resolve(respond([{ ...node, performance: 1000 }])));

    const error = await fetchOrgTree().catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).issues.length).toBeGreaterThan(0);
  });

  it('лишнее поле в узле — тоже ValidationError', async () => {
    mockFetch(() => Promise.resolve(respond([{ ...node, extra: 1 }])));

    await expect(fetchOrgTree()).rejects.toBeInstanceOf(ValidationError);
  });

  it('не-JSON тело даёт ValidationError', async () => {
    mockFetch(() => Promise.resolve(new Response('<html>не json</html>', { status: 200 })));

    await expect(fetchOrgTree()).rejects.toBeInstanceOf(ValidationError);
  });

  it('сетевой сбой даёт NetworkError', async () => {
    mockFetch(() => Promise.reject(new TypeError('Failed to fetch')));

    await expect(fetchOrgTree()).rejects.toBeInstanceOf(NetworkError);
  });

  it('отмена пробрасывается как AbortError, а не как сетевая ошибка', async () => {
    mockFetch(() => Promise.reject(new DOMException('Aborted', 'AbortError')));

    const error = await fetchOrgTree().catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(DOMException);
    expect((error as DOMException).name).toBe('AbortError');
  });

  it('передаёт signal в fetch — на нём держится отмена при размонтировании', async () => {
    mockFetch(() => Promise.resolve(respond([node], { etag: '"e.1"' })));
    const controller = new AbortController();

    await fetchOrgTree({ signal: controller.signal });

    expect(fetch).toHaveBeenCalledWith(
      '/api/org-tree',
      expect.objectContaining({ signal: controller.signal }),
    );
  });

  it('прокидывает режим кэша — им обходят устаревший ответ при разрыве версий', async () => {
    mockFetch(() => Promise.resolve(respond([node], { etag: '"e.1"' })));

    await fetchOrgTree({ cache: 'reload' });

    expect(fetch).toHaveBeenCalledWith(
      '/api/org-tree',
      expect.objectContaining({ cache: 'reload' }),
    );
  });
});
