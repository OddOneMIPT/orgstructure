import { z } from 'zod';

const booleanish = z
  .enum(['0', '1', 'true', 'false'])
  .default('0')
  .transform((value) => value === '1' || value === 'true');

const EnvSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  HOST: z.string().min(1).default('0.0.0.0'),
  /** Включает отладочные параметры запроса (?delay, ?fail, ?empty, ?invalid). */
  MOCK_DEBUG: booleanish,
});

export type Env = z.infer<typeof EnvSchema>;

export function parseEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = EnvSchema.safeParse(source);

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
