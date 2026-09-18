import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import {
  SearchFilterSchema,
  isEmptyFilter,
  type SearchFilter,
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
  if (!client && !env.ANTHROPIC_API_KEY) {
    return fallback('AI-поиск не настроен: не задан ANTHROPIC_API_KEY');
  }

  const messages = client ?? new Anthropic({ apiKey: env.ANTHROPIC_API_KEY }).messages;

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

    return { source: 'ai', filter, reason: null };
  } catch (error) {
    const reason =
      error instanceof Anthropic.APIError
        ? `AI-сервис ответил ошибкой ${error.status ?? ''}`.trim()
        : 'AI-сервис недоступен';

    return fallback(reason);
  }
}
