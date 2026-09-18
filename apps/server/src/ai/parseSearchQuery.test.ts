import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EMPTY_FILTER, type SearchFilter } from '@org/contracts';

import { parseEnv } from '../env.js';
import { parseSearchQuery, resetSearchCache } from './parseSearchQuery.js';

// Кэш и SDK-клиент живут на весь процесс — между тестами их надо обнулять.
beforeEach(resetSearchCache);

const env = (source: NodeJS.ProcessEnv = { ANTHROPIC_API_KEY: 'test-key' }) => parseEnv(source);

/** Подменяем только `parse`: настоящая сеть в тестах не нужна. */
const clientReturning = (parsed: unknown) => ({
  parse: vi.fn().mockResolvedValue({ parsed_output: parsed }),
});

const filter = (patch: Partial<SearchFilter>): SearchFilter => ({ ...EMPTY_FILTER, ...patch });

describe('parseSearchQuery', () => {
  it('возвращает разобранный фильтр', async () => {
    const client = clientReturning(filter({ budget: { min: 50_000_000, max: null } }));

    const result = await parseSearchQuery({
      env: env(),
      query: 'подразделения с бюджетом больше 50 млн',
      client,
    });

    expect(result).toEqual({
      source: 'ai',
      filter: filter({ budget: { min: 50_000_000, max: null } }),
      reason: null,
    });
  });

  it('передаёт запрос и таймаут', async () => {
    const client = clientReturning(filter({ levels: ['department'] }));

    await parseSearchQuery({ env: env(), query: 'отделы', client });

    expect(client.parse).toHaveBeenCalledWith(
      expect.objectContaining({ messages: [{ role: 'user', content: 'отделы' }] }),
      expect.objectContaining({ timeout: 8_000 }),
    );
  });

  it('без ключа сразу откатывается на текстовый поиск, не ходя в сеть', async () => {
    const result = await parseSearchQuery({ env: env({}), query: 'отделы' });

    expect(result.source).toBe('fallback');
    expect(result.filter).toBeNull();
    expect(result.reason).toMatch(/ANTHROPIC_API_KEY/);
  });

  it('ошибка сервиса — это fallback, а не падение', async () => {
    const client = { parse: vi.fn().mockRejectedValue(new Error('сеть недоступна')) };

    const result = await parseSearchQuery({ env: env(), query: 'отделы', client });

    expect(result).toMatchObject({ source: 'fallback', filter: null });
  });

  it('ответ не по схеме отбрасывается', async () => {
    const client = clientReturning({ budget: 'много' });

    const result = await parseSearchQuery({ env: env(), query: 'отделы', client });

    expect(result).toMatchObject({ source: 'fallback', reason: expect.stringMatching(/схеме/) });
  });

  it('null вместо разбора — тоже fallback', async () => {
    const client = clientReturning(null);

    expect(await parseSearchQuery({ env: env(), query: '?', client })).toMatchObject({
      source: 'fallback',
    });
  });

  it('пустой фильтр не применяется: он ничего не ограничивает', async () => {
    const client = clientReturning(EMPTY_FILTER);

    const result = await parseSearchQuery({ env: env(), query: 'привет', client });

    expect(result).toMatchObject({
      source: 'fallback',
      filter: null,
      reason: expect.stringMatching(/не удалось извлечь/),
    });
  });

  it('повторный запрос берётся из кэша и в модель не идёт', async () => {
    const client = clientReturning(filter({ levels: ['team'] }));

    const first = await parseSearchQuery({ env: env(), query: 'команды', client });
    const second = await parseSearchQuery({ env: env(), query: 'команды', client });

    expect(second).toEqual(first);
    expect(client.parse).toHaveBeenCalledTimes(1);
  });

  it('смена модели обнуляет попадание в кэш: разбор делала другая модель', async () => {
    const client = clientReturning(filter({ levels: ['team'] }));

    await parseSearchQuery({ env: env(), query: 'команды', client });
    await parseSearchQuery({
      env: env({ ANTHROPIC_API_KEY: 'test-key', AI_MODEL: 'claude-opus-5' }),
      query: 'команды',
      client,
    });

    expect(client.parse).toHaveBeenCalledTimes(2);
  });

  it('fallback не кэшируется: причина могла быть временной', async () => {
    const client = { parse: vi.fn().mockRejectedValue(new Error('сеть')) };

    await parseSearchQuery({ env: env(), query: 'отделы', client });
    await parseSearchQuery({ env: env(), query: 'отделы', client });

    expect(client.parse).toHaveBeenCalledTimes(2);
  });

  it('фильтр только с сортировкой считается пустым — фильтровать нечего', async () => {
    const client = clientReturning(filter({ sort: { column: 'budget', direction: 'desc' } }));

    expect(await parseSearchQuery({ env: env(), query: 'по бюджету', client })).toMatchObject({
      source: 'fallback',
    });
  });
});
