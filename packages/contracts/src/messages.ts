import { z } from 'zod';

/**
 * Патч одного узла: меняются только метрики. Структурные изменения (добавление,
 * удаление, перенос узла) инкрементально не применяются — для них есть `reset`,
 * после которого клиент перезапрашивает снимок целиком (ADR 004).
 */
export const NodeChangeSchema = z
  .object({
    id: z.string().min(1),
    updatedAt: z.iso.datetime(),
    headcount: z.int().min(0).optional(),
    budget: z.int().min(0).optional(),
    performance: z.number().min(0).max(100).optional(),
  })
  .strict();

export type NodeChange = z.infer<typeof NodeChangeSchema>;

const withRevision = {
  epoch: z.string().min(1),
  version: z.int().min(0),
};

/** Сразу после подключения: клиент сверяет ревизию и решает, нужен ли рефетч. */
export const HelloMessageSchema = z.object({ type: z.literal('hello'), ...withRevision }).strict();

/** `version` — ревизия ПОСЛЕ применения изменений. */
export const PatchMessageSchema = z
  .object({
    type: z.literal('patch'),
    ...withRevision,
    changes: z.array(NodeChangeSchema).min(1),
  })
  .strict();

/** Структура изменилась — инкрементально это не применить, нужен рефетч. */
export const ResetMessageSchema = z.object({ type: z.literal('reset'), ...withRevision }).strict();

/** Heartbeat: его отсутствие означает мёртвое соединение. */
export const PingMessageSchema = z.object({ type: z.literal('ping') }).strict();

export const ServerMessageSchema = z.discriminatedUnion('type', [
  HelloMessageSchema,
  PatchMessageSchema,
  ResetMessageSchema,
  PingMessageSchema,
]);

export type HelloMessage = z.infer<typeof HelloMessageSchema>;
export type PatchMessage = z.infer<typeof PatchMessageSchema>;
export type ResetMessage = z.infer<typeof ResetMessageSchema>;
export type PingMessage = z.infer<typeof PingMessageSchema>;
export type ServerMessage = z.infer<typeof ServerMessageSchema>;

/** Разбирает кадр WebSocket. `null` — сообщение невалидно и должно быть проигнорировано. */
export function parseServerMessage(raw: string): ServerMessage | null {
  try {
    const result = ServerMessageSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
