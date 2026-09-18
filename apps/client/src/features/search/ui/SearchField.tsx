import { Search, X } from 'lucide-react';
import styled from 'styled-components';

import { setQuery, useQuery } from '@/shared/model/dashboardStore';

const Wrapper = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
  width: min(320px, 100%);
  padding: ${({ theme }) => `${theme.spacing.xs} ${theme.spacing.sm}`};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.sm};
  background: ${({ theme }) => theme.colors.surface};
  color: ${({ theme }) => theme.colors.textMuted};

  &:focus-within {
    border-color: ${({ theme }) => theme.colors.accent};
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
 * Поле управляется мгновенным значением, а фильтрация идёт по отложенному (250 мс):
 * иначе ввод «залипал» бы на время задержки.
 */
export function SearchField() {
  const query = useQuery();

  return (
    <Wrapper>
      <Search size={15} aria-hidden />
      <Input
        type="search"
        value={query}
        placeholder="Поиск по названию"
        aria-label="Поиск подразделения по названию"
        onChange={(event) => {
          setQuery(event.target.value);
        }}
      />
      {query === '' ? null : (
        <Clear
          aria-label="Очистить поиск"
          onClick={() => {
            setQuery('');
          }}
        >
          <X size={15} aria-hidden />
        </Clear>
      )}
    </Wrapper>
  );
}
