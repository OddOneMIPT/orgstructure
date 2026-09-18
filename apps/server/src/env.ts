import { z } from 'zod';

const booleanish = z
  .enum(['0', '1', 'true', 'false'])
  .default('0')
  .transform((value) => value === '1' || value === 'true');

const EnvSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  HOST: z.string().min(1).default('0.0.0.0'),
  /** Включает отладочные параметры запроса (?delay, ?fail, ?empty, ?invalid). */
  MOCK_DEBUG: booleanish,
  /** Период имитации живых данных; 0 выключает тикер. */
  TICK_INTERVAL_MS: z.coerce.number().int().min(0).max(600_000).default(3_000),

  /** Без ключа AI-поиск честно откатывается на текстовый (ADR 007). */
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  /** Разбор короткой строки; `output_config.effort` поддерживают модели 4.6+ (ADR 007). */
  AI_MODEL: z.string().min(1).default('claude-sonnet-5'),
  AI_TIMEOUT_MS: z.coerce.number().int().min(500).max(60_000).default(8_000),
});

export type Env = z.infer<typeof EnvSchema>;

export function parseEnv(source: NodeJS.ProcessEnv = process.env): Env {
  // Пустая строка — это «не задано», а не значение. docker compose всегда подставляет
  // переменную (`${ANTHROPIC_API_KEY:-}`), и `.env` из примера тоже оставляет её пустой:
  // без этой очистки сервер падал бы на старте там, где ключа просто нет.
  const defined = Object.fromEntries(Object.entries(source).filter(([, value]) => value !== ''));

  const result = EnvSchema.safeParse(defined);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  ${issue.path.join('.') || '(корень)'}: ${issue.message}`)
      .join('\n');
    // Человекочитаемая ошибка вместо сырого ZodError (CLAUDE.md, раздел «Сервер»).
    throw new Error(`Некорректные переменные окружения:\n${details}`);
  }

  return result.data;
}

export const env = parseEnv();
