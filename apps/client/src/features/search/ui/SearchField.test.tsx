import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from 'styled-components';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EMPTY_FILTER, type SearchParseResponse } from '@org/contracts';

import { theme } from '@/shared/config/theme';
import { dashboardStore } from '@/shared/model/dashboardStore';

import { aiSearchStore } from '../model/aiSearchStore';
import { AiFilterChips } from './AiFilterChips';
import { SearchField } from './SearchField';

const parseSearchQuery = vi.hoisted(() => vi.fn());

vi.mock('@/shared/api', () => ({ parseSearchQuery }));

const aiFilter: SearchParseResponse = {
  source: 'ai',
  filter: { ...EMPTY_FILTER, levels: ['department'] },
  reason: null,
};

/** Ответ, которым управляет сам тест: так проверяется гонка с медленным запросом. */
const deferred = () => {
  let resolve!: (value: SearchParseResponse) => void;
  const promise = new Promise<SearchParseResponse>((r) => {
    resolve = r;
  });
  return { promise, resolve };
};

const renderField = () =>
  render(
    <ThemeProvider theme={theme}>
      <SearchField />
      <AiFilterChips />
    </ThemeProvider>,
  );

const field = () => screen.getByRole('searchbox');

beforeEach(() => {
  parseSearchQuery.mockReset();
  dashboardStore.setState(() => ({
    keyboardPanel: 'table',
    query: '',
    selectedId: null,
    view: 'table',
  }));
  aiSearchStore.setState(() => ({ ai: { status: 'idle' } }));
});

describe('SearchField', () => {
  it('текст фильтрует сразу, к модели не ходит', async () => {
    renderField();

    await userEvent.type(field(), 'облако');

    expect(dashboardStore.getState().query).toBe('облако');
    expect(parseSearchQuery).not.toHaveBeenCalled();
  });

  it('Enter отправляет запрос на разбор и применяет фильтр', async () => {
    parseSearchQuery.mockResolvedValue(aiFilter);
    renderField();

    await userEvent.type(field(), 'отделы{Enter}');

    expect(parseSearchQuery).toHaveBeenCalledWith('отделы', expect.any(AbortSignal));
    expect(await screen.findByText('AI применён')).toBeInTheDocument();
    expect(screen.getByText('Уровень: отделы')).toBeInTheDocument();
    expect(aiSearchStore.getState().ai).toEqual({ status: 'applied', filter: aiFilter.filter });
  });

  it('правка строки отменяет незавершённый разбор, и его ответ уже не применяется', async () => {
    // Гонка: пользователь дописывает запрос, пока предыдущий разбор ещё в полёте.
    const slow = deferred();
    parseSearchQuery.mockReturnValue(slow.promise);
    renderField();

    await userEvent.type(field(), 'отделы{Enter}');
    expect(aiSearchStore.getState().ai).toEqual({ status: 'parsing' });

    await userEvent.type(field(), ' и команды');

    const [, signal] = parseSearchQuery.mock.calls[0] as [string, AbortSignal];
    expect(signal.aborted).toBe(true);

    slow.resolve(aiFilter);
    await Promise.resolve();

    // Фильтр от прежнего запроса не должен включиться поверх нового текста.
    expect(aiSearchStore.getState().ai).toEqual({ status: 'idle' });
    expect(screen.queryByText('AI применён')).not.toBeInTheDocument();
  });

  it('fallback оставляет текстовый поиск и объясняет причину', async () => {
    parseSearchQuery.mockResolvedValue({
      source: 'fallback',
      filter: null,
      reason: 'AI-поиск не настроен',
    });
    renderField();

    await userEvent.type(field(), 'отделы{Enter}');

    expect(await screen.findByText(/AI-поиск не настроен/)).toBeInTheDocument();
    expect(dashboardStore.getState().query).toBe('отделы');
  });

  it('сбой запроса — тоже fallback, а не падение', async () => {
    parseSearchQuery.mockRejectedValue(new Error('сеть'));
    renderField();

    await userEvent.type(field(), 'отделы{Enter}');

    expect(await screen.findByText(/Сервис поиска недоступен/)).toBeInTheDocument();
  });

  it('пустой запрос к модели не уходит', async () => {
    renderField();

    await userEvent.type(field(), '   {Enter}');

    expect(parseSearchQuery).not.toHaveBeenCalled();
  });

  it('Escape очищает строку', async () => {
    renderField();

    await userEvent.type(field(), 'облако{Escape}');

    expect(dashboardStore.getState().query).toBe('');
  });
});
