import { describe, expect, it } from 'vitest';

import { nextDelay } from './backoff';

const max = { random: () => 1 };
const min = { random: () => 0 };

describe('nextDelay', () => {
  it('растёт экспоненциально от базовой задержки', () => {
    expect(nextDelay(0, { baseMs: 1000, ...max })).toBe(1000);
    expect(nextDelay(1, { baseMs: 1000, ...max })).toBe(2000);
    expect(nextDelay(2, { baseMs: 1000, ...max })).toBe(4000);
    expect(nextDelay(3, { baseMs: 1000, ...max })).toBe(8000);
  });

  it('упирается в потолок и дальше не растёт', () => {
    expect(nextDelay(10, { baseMs: 1000, capMs: 30_000, ...max })).toBe(30_000);
    expect(nextDelay(50, { baseMs: 1000, capMs: 30_000, ...max })).toBe(30_000);
  });

  it('джиттер размазывает попытки по всему интервалу', () => {
    expect(nextDelay(3, { baseMs: 1000, ...min })).toBe(0);
    expect(nextDelay(3, { baseMs: 1000, random: () => 0.5 })).toBe(4000);
    expect(nextDelay(3, { baseMs: 1000, ...max })).toBe(8000);
  });

  it('никогда не отрицательна и не превышает потолок', () => {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const delay = nextDelay(attempt, { baseMs: 1000, capMs: 30_000 });

      expect(delay).toBeGreaterThanOrEqual(0);
      expect(delay).toBeLessThanOrEqual(30_000);
    }
  });

  it('отрицательный номер попытки трактуется как первая', () => {
    expect(nextDelay(-5, { baseMs: 1000, ...max })).toBe(1000);
  });
});
