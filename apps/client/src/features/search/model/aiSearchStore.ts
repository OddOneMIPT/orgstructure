import type { SearchFilter } from '@org/contracts';

import { createStore, useStore } from '@/shared/lib/createStore';

export type AiSearchState =
  | { status: 'idle' }
  | { status: 'parsing' }
  /** Запрос разобран моделью — работает структурированный фильтр. */
  | { status: 'applied'; filter: SearchFilter }
  /** Разбора не было: показываем причину и остаёмся на текстовом поиске. */
  | { status: 'fallback'; reason: string };

/**
 * Состояние AI-разбора принадлежит фиче поиска и живёт здесь, а не в общем сторе:
 * читают его только сама фича и `app`, а `features` → `app` импортировать можно.
 * Раньше оно лежало в `shared/model`, и вместе с ним туда протекали и контракт
 * `SearchFilter`, и правило «правка строки сбрасывает разобранный фильтр».
 */
export const aiSearchStore = createStore<{ ai: AiSearchState }>({ ai: { status: 'idle' } });

export function setAiState(ai: AiSearchState): void {
  aiSearchStore.setState(() => ({ ai }));
}

/** Разобранный фильтр относился к прежнему запросу — с правкой строки он недействителен. */
export function resetAiState(): void {
  aiSearchStore.setState((prev) => (prev.ai.status === 'idle' ? prev : { ai: { status: 'idle' } }));
}

export const useAiSearch = (): AiSearchState => useStore(aiSearchStore, (state) => state.ai);
