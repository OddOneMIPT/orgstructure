import { describe, expect, it } from 'vitest';

import {
  describeStaff,
  formatBudget,
  formatCount,
  formatPercent,
  formatStaff,
  levelLabel,
  normalizeSpaces,
} from './format';

describe('formatBudget', () => {
  it('разделяет разряды и добавляет рубли, как в макете', () => {
    expect(normalizeSpaces(formatBudget(34_170_000))).toBe('34 170 000 руб.');
  });

  it('работает на малых и нулевых значениях', () => {
    expect(normalizeSpaces(formatBudget(0))).toBe('0 руб.');
    expect(normalizeSpaces(formatBudget(999))).toBe('999 руб.');
  });

  it('разделителем разрядов служит неразрывный пробел, а не обычный', () => {
    expect(formatBudget(1_000_000)).not.toContain(' 000');
  });
});

describe('formatPercent', () => {
  it('округляет до целого и добавляет процент', () => {
    expect(formatPercent(81.6)).toBe('82%');
    expect(formatPercent(0)).toBe('0%');
    expect(formatPercent(100)).toBe('100%');
  });

  it('вместо отсутствующего значения показывает прочерк', () => {
    expect(formatPercent(null)).toBe('—');
  });
});

describe('formatStaff', () => {
  it('показывает собственный и суммарный штат', () => {
    expect(normalizeSpaces(formatStaff(3, 128))).toBe('3 / 128');
  });

  it('у листа показывает одно число: второе ничего не добавляет', () => {
    expect(formatStaff(7, 7)).toBe('7');
  });

  it('расшифровывает оба числа для скринридера', () => {
    expect(describeStaff(3, 128)).toMatch(/3 сотрудников в самом подразделении/);
    expect(describeStaff(7, 7)).toBe('7 сотрудников');
  });
});

describe('levelLabel', () => {
  it('называет три уровня из макета', () => {
    expect(levelLabel(0)).toBe('дивизион');
    expect(levelLabel(1)).toBe('отдел');
    expect(levelLabel(2)).toBe('команда');
  });

  it('глубже — нейтральное «уровень N»', () => {
    expect(levelLabel(3)).toBe('уровень 4');
  });
});

describe('formatCount', () => {
  it('разделяет разряды', () => {
    expect(normalizeSpaces(formatCount(12345))).toBe('12 345');
  });
});
