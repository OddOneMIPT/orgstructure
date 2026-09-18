import { OrgTreeResponseSchema, parseRevision, type OrgNode } from '@org/contracts';
import type { FastifyInstance } from 'fastify';
import type { Response as InjectResponse } from 'light-my-request';
import { afterEach, describe, expect, it } from 'vitest';

import { buildServer } from './app.js';
import { parseEnv } from './env.js';

let app: FastifyInstance | undefined;

/** Заголовок обязан быть строкой — иначе тест должен падать, а не молча приводить тип. */
const etagOf = (response: InjectResponse): string => {
  const value = response.headers.etag;
  if (typeof value !== 'string') throw new Error('Ответ без заголовка ETag');
  return value;
};

const nodesOf = (response: InjectResponse): OrgNode[] => response.json<OrgNode[]>();

const start = async (envSource: NodeJS.ProcessEnv = {}): Promise<FastifyInstance> => {
  app = await buildServer({ env: parseEnv(envSource), logger: false });
  return app;
};

afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe('GET /api/health', () => {
  it('отвечает ok', async () => {
    const server = await start();
    const response = await server.inject({ method: 'GET', url: '/api/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: 'ok' });
  });
});

describe('GET /api/org-tree', () => {
  it('возвращает плоский массив, проходящий схему контракта', async () => {
    const server = await start();
    const response = await server.inject({ method: 'GET', url: '/api/org-tree' });

    expect(response.statusCode).toBe(200);
    const parsed = OrgTreeResponseSchema.safeParse(response.json());
    expect(parsed.success).toBe(true);
    expect(nodesOf(response).length).toBeGreaterThanOrEqual(48);
  });

  it('отдаёт ETag с разбираемой ревизией и Cache-Control: no-cache', async () => {
    const server = await start();
    const response = await server.inject({ method: 'GET', url: '/api/org-tree' });

    expect(response.headers['cache-control']).toBe('no-cache');
    const revision = parseRevision(etagOf(response));
    expect(revision).not.toBeNull();
    expect(revision?.version).toBe(0);
  });

  it('на совпадающий If-None-Match отвечает 304 без тела', async () => {
    const server = await start();
    const first = await server.inject({ method: 'GET', url: '/api/org-tree' });
    const etag = etagOf(first);

    const second = await server.inject({
      method: 'GET',
      url: '/api/org-tree',
      headers: { 'if-none-match': etag },
    });

    expect(second.statusCode).toBe(304);
    expect(second.body).toBe('');
  });

  it('принимает слабый If-None-Match — его мог переписать прокси', async () => {
    const server = await start();
    const first = await server.inject({ method: 'GET', url: '/api/org-tree' });
    const etag = etagOf(first);

    const second = await server.inject({
      method: 'GET',
      url: '/api/org-tree',
      headers: { 'if-none-match': `W/${etag}` },
    });

    expect(second.statusCode).toBe(304);
  });

  it('на чужой If-None-Match отвечает полным телом', async () => {
    const server = await start();
    const response = await server.inject({
      method: 'GET',
      url: '/api/org-tree',
      headers: { 'if-none-match': '"other.1"' },
    });

    expect(response.statusCode).toBe(200);
    expect(nodesOf(response).length).toBeGreaterThanOrEqual(48);
  });

  it('две эпохи разных запусков отличаются — иначе рестарт был бы незаметен', async () => {
    const first = await buildServer({ env: parseEnv({}), logger: false });
    const second = await buildServer({ env: parseEnv({}), logger: false });

    const a = parseRevision(etagOf(await first.inject({ url: '/api/org-tree' })));
    const b = parseRevision(etagOf(await second.inject({ url: '/api/org-tree' })));

    await first.close();
    await second.close();

    expect(a?.epoch).not.toBe(b?.epoch);
  });
});

describe('отладочные параметры', () => {
  it('игнорируются, когда MOCK_DEBUG выключен', async () => {
    const server = await start();
    const response = await server.inject({ method: 'GET', url: '/api/org-tree?fail=1&empty=1' });

    expect(response.statusCode).toBe(200);
    expect(nodesOf(response).length).toBeGreaterThanOrEqual(48);
  });

  it('?fail=1 отдаёт 500', async () => {
    const server = await start({ MOCK_DEBUG: '1' });
    const response = await server.inject({ method: 'GET', url: '/api/org-tree?fail=1' });

    expect(response.statusCode).toBe(500);
  });

  it('?empty=1 отдаёт пустой массив — это валидный ответ', async () => {
    const server = await start({ MOCK_DEBUG: '1' });
    const response = await server.inject({ method: 'GET', url: '/api/org-tree?empty=1' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([]);
    expect(OrgTreeResponseSchema.safeParse(response.json()).success).toBe(true);
  });

  it('?invalid=1 отдаёт тело, не проходящее схему', async () => {
    const server = await start({ MOCK_DEBUG: '1' });
    const response = await server.inject({ method: 'GET', url: '/api/org-tree?invalid=1' });

    expect(response.statusCode).toBe(200);
    expect(OrgTreeResponseSchema.safeParse(response.json()).success).toBe(false);
  });

  it('?delay задерживает ответ', async () => {
    const server = await start({ MOCK_DEBUG: '1' });
    const startedAt = Date.now();
    await server.inject({ method: 'GET', url: '/api/org-tree?delay=120' });

    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(100);
  });
});

describe('parseEnv', () => {
  it('подставляет значения по умолчанию', () => {
    expect(parseEnv({})).toEqual({ PORT: 3000, HOST: '0.0.0.0', MOCK_DEBUG: false });
  });

  it('читает MOCK_DEBUG', () => {
    expect(parseEnv({ MOCK_DEBUG: '1' }).MOCK_DEBUG).toBe(true);
  });

  it('падает с человекочитаемым текстом при неверном PORT', () => {
    expect(() => parseEnv({ PORT: 'не-число' })).toThrow(/переменные окружения/i);
  });
});
