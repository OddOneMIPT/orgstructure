import { z } from 'zod';

/** Уровень подразделения — то же, что показывает колонка «Уровень». */
export const OrgLevelSchema = z.enum(['division', 'department', 'team']);

export const SortColumnSchema = z.enum(['name', 'level', 'headcount', 'budget', 'performance']);

const RangeSchema = z
  .object({
    min: z.number().nullable(),
    max: z.number().nullable(),
  })
  .strict();

/**
 * Структурированный фильтр — результат разбора естественно-языкового запроса.
 *
 * Поля не опциональные, а `nullable`: structured outputs требуют, чтобы все свойства
 * были обязательными, поэтому «не задано» выражается через `null`.
 *
 * Пороговые поля сравниваются с **агрегатами** таблицы (сумма по поддереву), потому что
 * именно их видит пользователь в строке.
 */
export const SearchFilterSchema = z
  .object({
    /** Подстрока в названии. */
    name: z.string().nullable(),
    levels: z.array(OrgLevelSchema).nullable(),
    /** Суммарная численность по поддереву. */
    headcount: RangeSchema.nullable(),
    /** Суммарный бюджет по поддереву, рубли. */
    budget: RangeSchema.nullable(),
    /** Средняя эффективность, 0–100. */
    performance: RangeSchema.nullable(),
    sort: z
      .object({
        column: SortColumnSchema,
        direction: z.enum(['asc', 'desc']),
      })
      .strict()
      .nullable(),
  })
  .strict();

export type OrgLevel = z.infer<typeof OrgLevelSchema>;
export type SearchFilter = z.infer<typeof SearchFilterSchema>;

export const SearchParseRequestSchema = z.object({ query: z.string().min(1).max(500) }).strict();

export type SearchParseRequest = z.infer<typeof SearchParseRequestSchema>;

/**
 * `source` честно говорит, что произошло: `ai` — запрос разобрала модель,
 * `fallback` — разбора не было (нет ключа, таймаут, ошибка, невалидный ответ),
 * и клиент остаётся на обычном текстовом поиске.
 */
export const SearchParseResponseSchema = z
  .object({
    source: z.enum(['ai', 'fallback']),
    filter: SearchFilterSchema.nullable(),
    /** Почему не получилось — показывается в подсказке, а не прячется в логах. */
    reason: z.string().nullable(),
  })
  .strict();

export type SearchParseResponse = z.infer<typeof SearchParseResponseSchema>;

export const EMPTY_FILTER: SearchFilter = {
  name: null,
  levels: null,
  headcount: null,
  budget: null,
  performance: null,
  sort: null,
};

/** Пустой фильтр ничего не ограничивает — применять его бессмысленно. */
export function isEmptyFilter(filter: SearchFilter): boolean {
  return (
    filter.name === null &&
    filter.levels === null &&
    filter.headcount === null &&
    filter.budget === null &&
    filter.performance === null
  );
}
