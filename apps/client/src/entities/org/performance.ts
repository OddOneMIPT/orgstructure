/** Тон индикатора эффективности. Правило доменное, поэтому живёт рядом с моделью. */
export type PerformanceTone = 'low' | 'mid' | 'high';

export const PERFORMANCE_THRESHOLDS = { mid: 50, high: 75 } as const;

export function performanceTone(value: number): PerformanceTone {
  if (value >= PERFORMANCE_THRESHOLDS.high) return 'high';
  if (value >= PERFORMANCE_THRESHOLDS.mid) return 'mid';
  return 'low';
}
