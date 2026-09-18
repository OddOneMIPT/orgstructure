import { describe, expect, it } from 'vitest';

import { formatRevision, isSameRevision, parseRevision } from './revision.js';

const epoch = '7f1c3b2a-0000-4000-8000-000000000001';

describe('formatRevision', () => {
  it('складывает эпоху и версию в значение ETag', () => {
    expect(formatRevision({ epoch, version: 12 })).toBe(`"${epoch}.12"`);
  });
});

describe('parseRevision', () => {
  it('разбирает обычный ETag', () => {
    expect(parseRevision(`"${epoch}.12"`)).toEqual({ epoch, version: 12 });
  });

  it('разбирает слабый ETag — nginx помечает его таким при сжатии ответа', () => {
    expect(parseRevision(`W/"${epoch}.12"`)).toEqual({ epoch, version: 12 });
  });

  it('терпит пробелы вокруг значения', () => {
    expect(parseRevision(`  "${epoch}.0" `)).toEqual({ epoch, version: 0 });
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['пустая строка', ''],
    ['без кавычек', `${epoch}.12`],
    ['без версии', `"${epoch}"`],
    ['нечисловая версия', `"${epoch}.abc"`],
    ['чужой формат', '"33a64df551425fcc55e4d42a148795d9f25f89d4"'],
  ])('возвращает null: %s', (_label, value) => {
    expect(parseRevision(value)).toBeNull();
  });
});

describe('isSameRevision', () => {
  it('совпадает при одной эпохе и версии', () => {
    expect(isSameRevision({ epoch, version: 3 }, { epoch, version: 3 })).toBe(true);
  });

  it('не совпадает при разных версиях', () => {
    expect(isSameRevision({ epoch, version: 3 }, { epoch, version: 4 })).toBe(false);
  });

  it('не совпадает при одинаковой версии, но другой эпохе — это и есть защита от рестарта', () => {
    expect(isSameRevision({ epoch, version: 3 }, { epoch: 'другая', version: 3 })).toBe(false);
  });

  it('неизвестная ревизия не равна ничему, включая другую неизвестную', () => {
    expect(isSameRevision(null, { epoch, version: 3 })).toBe(false);
    expect(isSameRevision(null, null)).toBe(false);
  });
});
