import { createContext } from 'react';

import { ALL_VISIBLE, EMPTY_MODEL, type FilteredView, type OrgModel } from '@/entities/org';

export interface OrgTreeContextValue {
  model: OrgModel;
  view: FilteredView;
  /** Строка поиска — только для подсветки совпадений. */
  query: string;
}

/**
 * Раздаётся контекстом, чтобы пропсы узла остались примитивами и `memo` не сбрасывался,
 * когда родитель перерисовался сам по себе.
 *
 * Чего это **не** даёт: `model` лежит прямо здесь, поэтому живой патч меняет значение
 * контекста, и перерисовываются все узлы разом — `memo` на это не влияет. Спасает он от
 * другого: раскрытие ветки и смена выделения идут через сторы с селекторами, узел
 * подписан на свой `id`, и дерево целиком там не перерисовывается.
 *
 * Чтобы `memo` работал и на патчах, узел должен подписываться на **свои** `node` и
 * `aggregate` через селектор, а не получать всю модель: `buildModel` и `applyPatch` уже
 * сохраняют ссылки нетронутых узлов, так что сравнение по идентичности сработало бы
 * (ADR 003). Не сделано намеренно — см. README, «Что осознанно не сделано».
 */
export const OrgTreeContext = createContext<OrgTreeContextValue>({
  model: EMPTY_MODEL,
  view: ALL_VISIBLE,
  query: '',
});
