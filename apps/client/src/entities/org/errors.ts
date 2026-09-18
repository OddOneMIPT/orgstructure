export type IntegrityReason = 'duplicate' | 'orphan' | 'cycle';

const MESSAGES: Record<IntegrityReason, string> = {
  duplicate: 'в ответе есть узлы с одинаковым id',
  orphan: 'узел ссылается на несуществующего родителя',
  cycle: 'в дереве есть цикл — часть узлов недостижима от корней',
};

/**
 * Данные прошли схему, но деревом не являются.
 *
 * Молча «чинить» такой ответ нельзя: дерево и таблица начали бы показывать разные
 * множества узлов, а для дашборда мониторинга честная ошибка полезнее (ADR 002).
 */
export class IntegrityError extends Error {
  override readonly name = 'IntegrityError';

  constructor(
    readonly reason: IntegrityReason,
    readonly ids: readonly string[] = [],
  ) {
    const sample = ids.slice(0, 3).join(', ');
    super(`Нарушена целостность дерева: ${MESSAGES[reason]}${sample ? ` (${sample})` : ''}`);
  }
}
