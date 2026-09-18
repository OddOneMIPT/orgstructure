import { Search, Sparkles, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import styled from 'styled-components';

import { parseSearchQuery } from '@/shared/api';
import { setQuery, useQuery } from '@/shared/model/dashboardStore';

import { resetAiState, setAiState, useAiSearch } from '../model/aiSearchStore';
import { Spinner } from '@/shared/ui';

const Wrapper = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
  width: min(360px, 100%);
  padding: ${({ theme }) => `${theme.spacing.xs} ${theme.spacing.sm}`};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.sm};
  background: ${({ theme }) => theme.colors.surface};
  color: ${({ theme }) => theme.colors.textMuted};

  &:focus-within {
    border-color: ${({ theme }) => theme.colors.accent};
  }

  /* Запрос разобран моделью — зелёная иконка, как в макете. */
  &[data-ai='applied'] {
    border-color: ${({ theme }) => theme.colors.status.ok};
    color: ${({ theme }) => theme.colors.status.ok};
  }
`;

const Input = styled.input`
  flex: 1;
  min-width: 0;
  border: 0;
  background: none;
  color: ${({ theme }) => theme.colors.text};
  font: inherit;

  &:focus {
    outline: none;
  }

  /* Свой крестик уже есть — родной от type="search" дал бы вторую кнопку подряд. */
  &::-webkit-search-cancel-button {
    appearance: none;
    display: none;
  }
`;

const Clear = styled.button.attrs({ type: 'button' })`
  display: inline-flex;
  flex: none;
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  cursor: pointer;

  &:hover {
    color: ${({ theme }) => theme.colors.text};
  }
`;

/**
 * Одна строка на оба режима: текстовый фильтр работает сразу (дебаунс 250 мс),
 * а Enter отправляет запрос на разбор AI. Если разбора не случилось, поиск
 * остаётся текстовым — см. ADR 007.
 */
export function SearchField() {
  const query = useQuery();
  const ai = useAiSearch();
  const request = useRef<AbortController | null>(null);

  /**
   * Правка строки отменяет незавершённый разбор. Без этого ответ на прежний
   * запрос приходил уже после того, как пользователь переписал строку, и
   * включал фильтр поверх нового текста: `setQuery` сбрасывает состояние в
   * `idle`, но сам запрос продолжал лететь.
   */
  useEffect(() => {
    request.current?.abort();
    request.current = null;
  }, [query]);

  useEffect(
    () => () => {
      request.current?.abort();
    },
    [],
  );

  const runAiParse = (): void => {
    const text = query.trim();
    if (text === '') return;

    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;

    setAiState({ status: 'parsing' });

    void parseSearchQuery(text, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;

        setAiState(
          result.source === 'ai' && result.filter
            ? { status: 'applied', filter: result.filter }
            : { status: 'fallback', reason: result.reason ?? 'Запрос не разобран' },
        );
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setAiState({ status: 'fallback', reason: 'Сервис поиска недоступен' });
      });
  };

  return (
    <Wrapper data-ai={ai.status}>
      {ai.status === 'parsing' ? <Spinner size={15} /> : null}
      {ai.status === 'applied' ? <Sparkles size={15} aria-hidden /> : null}
      {ai.status === 'parsing' || ai.status === 'applied' ? null : <Search size={15} aria-hidden />}

      <Input
        type="search"
        value={query}
        placeholder="Поиск или запрос: «отделы с бюджетом больше 50 млн»"
        aria-label="Поиск подразделения: по названию или запросом на естественном языке"
        onChange={(event) => {
          setQuery(event.target.value);
          // Разобранный фильтр относился к прежнему тексту — правило фичи, а не стора.
          resetAiState();
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            setQuery('');
            resetAiState();
            return;
          }

          if (event.key === 'Enter') {
            event.preventDefault();
            runAiParse();
          }
        }}
      />

      {query === '' ? null : (
        <Clear
          aria-label="Очистить поиск"
          onClick={() => {
            setQuery('');
            resetAiState();
          }}
        >
          <X size={15} aria-hidden />
        </Clear>
      )}
    </Wrapper>
  );
}
