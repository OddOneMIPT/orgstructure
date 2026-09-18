import { type SearchParseResponse, SearchParseResponseSchema } from '@org/contracts';

export const SEARCH_PARSE_URL = '/api/search/parse';

/**
 * Разбор запроса живёт на сервере — ключ AI не должен попадать в клиентский бандл.
 * Любая осечка здесь превращается в `fallback`: поиск обязан продолжать работать.
 */
export async function parseSearchQuery(
  query: string,
  signal?: AbortSignal,
): Promise<SearchParseResponse> {
  const response = await fetch(SEARCH_PARSE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
    signal: signal ?? null,
  });

  if (!response.ok) {
    return { source: 'fallback', filter: null, reason: `Сервис поиска ответил ${response.status}` };
  }

  const parsed = SearchParseResponseSchema.safeParse(await response.json());

  return parsed.success
    ? parsed.data
    : { source: 'fallback', filter: null, reason: 'Некорректный ответ сервиса поиска' };
}
