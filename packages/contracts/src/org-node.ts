import { z } from 'zod';

/**
 * Узел орг-структуры ровно в том виде, в каком его отдаёт `GET /api/org-tree`.
 *
 * `.strict()` осознанно: задание требует «невалидный ответ — ошибка», а zod по умолчанию
 * молча срезает лишние ключи, и расхождение контракта осталось бы незамеченным (ADR 002).
 */
export const OrgNodeSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    /** `null` — корень (дивизион). */
    parentId: z.string().min(1).nullable(),
    headcount: z.int().min(0),
    budget: z.int().min(0),
    performance: z.number().min(0).max(100),
    updatedAt: z.iso.datetime(),
  })
  .strict();

export type OrgNode = z.infer<typeof OrgNodeSchema>;

/** Тело ответа `GET /api/org-tree` — плоский массив (контракт из задания). */
export const OrgTreeResponseSchema = z.array(OrgNodeSchema);

export type OrgTreeResponse = z.infer<typeof OrgTreeResponseSchema>;

export type OrgNodeId = OrgNode['id'];
