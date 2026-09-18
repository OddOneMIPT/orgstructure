import { createContext } from 'react';

import { ALL_VISIBLE, EMPTY_MODEL, type FilteredView, type OrgModel } from '@/entities/org';

export interface OrgTreeContextValue {
  model: OrgModel;
  view: FilteredView;
  /** Строка поиска — только для подсветки совпадений. */
  query: string;
}

/**
 * Раздаётся контекстом, чтобы пропсы узла остались примитивами
 * и `memo` не сбрасывался на каждой перерисовке родителя.
 */
export const OrgTreeContext = createContext<OrgTreeContextValue>({
  model: EMPTY_MODEL,
  view: ALL_VISIBLE,
  query: '',
});
