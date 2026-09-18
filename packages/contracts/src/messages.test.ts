import { describe, expect, it } from 'vitest';

import { parseServerMessage, ServerMessageSchema } from './messages.js';

const patch = {
  type: 'patch',
  epoch: 'e1',
  version: 12,
  changes: [{ id: 'team-1', updatedAt: '2026-09-18T09:00:00.000Z', headcount: 11 }],
};

describe('ServerMessageSchema', () => {
  it('принимает hello', () => {
    expect(ServerMessageSchema.parse({ type: 'hello', epoch: 'e1', version: 0 })).toEqual({
      type: 'hello',
      epoch: 'e1',
      version: 0,
    });
  });

  it('принимает patch с частичным изменением метрик', () => {
    expect(ServerMessageSchema.safeParse(patch).success).toBe(true);
  });

  it('принимает reset и ping', () => {
    expect(ServerMessageSchema.safeParse({ type: 'reset', epoch: 'e1', version: 3 }).success).toBe(
      true,
    );
    expect(ServerMessageSchema.safeParse({ type: 'ping' }).success).toBe(true);
  });

  it('требует хотя бы одно изменение в патче — пустой патч бессмыслен', () => {
    expect(ServerMessageSchema.safeParse({ ...patch, changes: [] }).success).toBe(false);
  });

  it('отвергает неизвестный тип', () => {
    expect(ServerMessageSchema.safeParse({ type: 'что-то', epoch: 'e1', version: 1 }).success).toBe(
      false,
    );
  });

  it('отвергает патч без ревизии', () => {
    const { epoch: _epoch, ...withoutEpoch } = patch;
    expect(ServerMessageSchema.safeParse(withoutEpoch).success).toBe(false);
  });

  it('отвергает значения вне диапазона схемы узла', () => {
    const broken = { ...patch, changes: [{ ...patch.changes[0], performance: 101 }] };
    expect(ServerMessageSchema.safeParse(broken).success).toBe(false);
  });

  it('отвергает лишние поля', () => {
    expect(ServerMessageSchema.safeParse({ ...patch, extra: 1 }).success).toBe(false);
  });
});

describe('parseServerMessage', () => {
  it('разбирает корректный кадр', () => {
    expect(parseServerMessage(JSON.stringify(patch))?.type).toBe('patch');
  });

  it('возвращает null на не-JSON, а не бросает', () => {
    expect(parseServerMessage('не json')).toBeNull();
  });

  it('возвращает null на валидном JSON с невалидной схемой', () => {
    expect(parseServerMessage('{"type":"patch"}')).toBeNull();
  });
});
