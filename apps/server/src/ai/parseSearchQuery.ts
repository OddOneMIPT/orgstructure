import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';

import {
  isEmptyFilter,
  type SearchFilter,
  SearchFilterSchema,
  type SearchParseResponse,
} from '@org/contracts';

import type { Env } from '../env.js';

const SYSTEM = `Ты разбираешь запрос пользователя к дашборду орг-структуры компании и возвращаешь структурированный фильтр.

Данные: дерево «дивизион → отдел → команда». У каждой строки таблицы есть
- name — название подразделения;
- level — division | department | team;
- headcount — СУММАРНАЯ численность по подразделению и всем вложенным;
- budget — СУММАРНЫЙ бюджет в рублях;
- performance — средняя эффективность 0–100, взвешенная по численности.

Правила:
- Заполняй только то, что явно следует из запроса; остальное оставляй null.
- Границы диапазонов включающие. «больше 50 млн» → budget.min = 50000000.
- «млн» = 1000000, «тыс» = 1000.
- Слова «отдел», «дивизион», «команда» — это levels, а не подстрока в названии.
- В name клади только фрагмент названия, если пользователь явно назвал подразделение.
- sort заполняй, только если о порядке попросили явно.
- Если запрос не про фильтрацию (приветствие, вопрос, бессмыслица) — верни все поля null.`;

export interface ParseSearchQueryOptions {
  env: Env;
  query: string;
  /** Для тестов: подменяемый клиент. */
  client?: Pick<Anthropic['messages'], 'parse'>;
}

/**
 * SDK-клиент живёт один на процесс: он держит пул соединений, и создавать его
 * на каждый запрос — значит каждый раз поднимать TLS заново.
 */
let shared: { key: string; messages: Pick<Anthropic['messages'], 'parse'> } | null = null;

const sharedClient = (apiKey: string): Pick<Anthropic['messages'], 'parse'> => {
  if (shared?.key !== apiKey)
    shared = { key: apiKey, messages: new Anthropic({ apiKey }).messages };
  return shared.messages;
};

/**
 * Одинаковые запросы разбираются одинаково, поэтому повтор не стоит похода к модели:
 * это и деньги, и задержка. Кэш ограничен по размеру — иначе он течёт.
 */
const CACHE_LIMIT = 100;
const cache = new Map<string, SearchFilter>();

const remember = (query: string, filter: SearchFilter): void => {
  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next();
    if (!oldest.done) cache.delete(oldest.value);
  }
  cache.set(query, filter);
};

/** Только для тестов: кэш и клиент переживают модуль, а тесты должны быть независимы. */
export function resetSearchCache(): void {
  cache.clear();
  shared = null;
}

const fallback = (reason: string): SearchParseResponse => ({
  source: 'fallback',
  filter: null,
  reason,
});

/**
 * Превращает естественно-языковой запрос в структурированный фильтр.
 *
 * Любая осечка — нет ключа, таймаут, сетевая ошибка, невалидный ответ модели — это
 * не ошибка приложения, а `source: 'fallback'`: клиент просто остаётся на обычном
 * текстовом поиске (ADR 007). Поиск не должен переставать работать из-за AI.
 */
export async function parseSearchQuery({
  env,
  query,
  client,
}: ParseSearchQueryOptions): Promise<SearchParseResponse> {
  const key = env.ANTHROPIC_API_KEY;

  // Разбор по веткам, а не `??` с приведением: так `key` сужается сам.
  let messages: Pick<Anthropic['messages'], 'parse'>;
  if (client) {
    messages = client;
  } else if (key) {
    messages = sharedClient(key);
  } else {
    return fallback('AI-поиск не настроен: не задан ANTHROPIC_API_KEY');
  }

  // Ключ включает модель: сменили AI_MODEL — прежние разборы больше не её.
  const cacheKey = `${env.AI_MODEL}\u0000${query}`;
  const cached = cache.get(cacheKey);
  if (cached) return { source: 'ai', filter: cached, reason: null };

  try {
    const response = await messages.parse(
      {
        model: env.AI_MODEL,
        max_tokens: 1_024,
        system: SYSTEM,
        // Разбор короткой строки — не та задача, где нужна глубина рассуждения.
        output_config: {
          effort: 'low',
          format: zodOutputFormat(SearchFilterSchema),
        },
        messages: [{ role: 'user', content: query }],
      },
      { timeout: env.AI_TIMEOUT_MS },
    );

    // Ответ модели всё равно проходит нашу схему: доверять чужому выводу без проверки нельзя.
    const parsed = SearchFilterSchema.safeParse(response.parsed_output);
    if (!parsed.success) {
      return fallback('Модель вернула ответ не по схеме');
    }

    const filter: SearchFilter = parsed.data;
    if (isEmptyFilter(filter)) {
      return fallback('Из запроса не удалось извлечь условия фильтрации');
    }

    remember(cacheKey, filter);

    return { source: 'ai', filter, reason: null };
  } catch (error) {
    const reason =
      error instanceof Anthropic.APIError
        ? `AI-сервис ответил ошибкой ${error.status ?? ''}`.trim()
        : 'AI-сервис недоступен';

    return fallback(reason);
  }
}
