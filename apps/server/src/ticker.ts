import type { NodeChange } from '@org/contracts';

import type { OrgStore } from './store.js';

export interface TickerOptions {
  store: OrgStore;
  intervalMs: number;
  /** Инъекция ради детерминированных тестов. */
  random?: () => number;
  now?: () => Date;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

/**
 * Имитация живых данных: раз в интервал меняет метрики 1–3 случайных узлов.
 * Значения остаются в границах схемы, иначе клиент справедливо отверг бы патч.
 */
export function createTicker({
  store,
  intervalMs,
  random = Math.random,
  now = () => new Date(),
}: TickerOptions) {
  const pick = <T>(items: T[]): T[] => {
    const count = 1 + Math.floor(random() * 3);
    const chosen: T[] = [];

    for (let i = 0; i < count && items.length > 0; i += 1) {
      const item = items[Math.floor(random() * items.length)];
      if (item !== undefined && !chosen.includes(item)) chosen.push(item);
    }

    return chosen;
  };

  const tick = (): void => {
    const changes: NodeChange[] = [];
    const updatedAt = now().toISOString();

    for (const id of pick(store.ids())) {
      const node = store.get(id);
      if (!node) continue;

      changes.push({
        id,
        updatedAt,
        headcount: clamp(node.headcount + Math.round((random() - 0.5) * 6), 1, 200),
        performance: clamp(Math.round(node.performance + (random() - 0.5) * 20), 0, 100),
      });
    }

    if (changes.length > 0) store.mutate(changes);
  };

  let timer: NodeJS.Timeout | undefined;

  return {
    tick,
    start(): void {
      if (intervalMs <= 0 || timer) return;
      timer = setInterval(tick, intervalMs);
      // Тикер не должен держать процесс живым сам по себе.
      timer.unref?.();
    },
    stop(): void {
      if (!timer) return;
      clearInterval(timer);
      timer = undefined;
    },
  };
}

export type Ticker = ReturnType<typeof createTicker>;
