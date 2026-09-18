import type { OrgNode } from '@org/contracts';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { ThemeProvider } from 'styled-components';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { treeUiStore } from '@/features/org-tree';
import { dashboardStore, setView } from '@/shared/model/dashboardStore';
import { HttpError, fetchOrgTree, type OrgTreeFetchResult } from '@/shared/api';
import { theme } from '@/shared/config/theme';

import { OrgDashboard } from './OrgDashboard';
import { createQueryClient } from './queryClient';

vi.mock('@/shared/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/api')>();
  return { ...actual, fetchOrgTree: vi.fn() };
});

const fetchOrgTreeMock = vi.mocked(fetchOrgTree);

const node = (id: string, parentId: string | null, name = id): OrgNode => ({
  id,
  name,
  parentId,
  headcount: 7,
  budget: 1_000_000,
  performance: 80,
  updatedAt: '2026-09-18T09:00:00.000Z',
});

const ok = (nodes: OrgNode[], version = 1): OrgTreeFetchResult => ({
  status: 'ok',
  nodes,
  revision: { epoch: 'e1', version },
});

function renderDashboard(): { unmount: () => void } {
  const queryClient = createQueryClient();
  // Ретраи выключены: тест проверяет состояния, а не политику повторов.
  queryClient.setDefaultOptions({ queries: { retry: false, structuralSharing: false } });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>{children}</ThemeProvider>
    </QueryClientProvider>
  );

  return render(<OrgDashboard />, { wrapper });
}

beforeEach(() => {
  fetchOrgTreeMock.mockReset();
  treeUiStore.setState(() => ({ expanded: new Set(), initializedFor: null }));
  dashboardStore.setState(() => ({
    ai: { status: 'idle' },
    keyboardPanel: 'table',
    query: '',
    selectedId: null,
    view: 'table',
  }));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('OrgDashboard', () => {
  it('показывает скелетон, пока данных нет', () => {
    fetchOrgTreeMock.mockReturnValue(new Promise(() => undefined));
    renderDashboard();

    expect(screen.getByText(/загружаем орг-структуру/i)).toBeInTheDocument();
  });

  it('показывает таблицу, когда данные пришли', async () => {
    fetchOrgTreeMock.mockResolvedValue(ok([node('div', null, 'Технологии')]));
    renderDashboard();

    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(screen.getByText('Технологии')).toBeInTheDocument();
  });

  it('на узком экране переключается на дерево', async () => {
    fetchOrgTreeMock.mockResolvedValue(ok([node('div', null, 'Технологии')]));
    renderDashboard();
    await screen.findByRole('table');

    act(() => {
      setView('tree');
    });

    expect(screen.getByRole('tree')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('показывает пустое состояние на пустой ответ', async () => {
    fetchOrgTreeMock.mockResolvedValue(ok([]));
    renderDashboard();

    expect(await screen.findByText(/орг-структура пуста/i)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('показывает ошибку сервера с кодом ответа', async () => {
    fetchOrgTreeMock.mockRejectedValue(new HttpError(500));
    renderDashboard();

    expect(await screen.findByRole('alert')).toHaveTextContent(/сервер ответил ошибкой/i);
    expect(screen.getByText(/код ответа 500/i)).toBeInTheDocument();
  });

  it('различает ошибку схемы и ошибку сети по тексту', async () => {
    const { ValidationError } = await import('@/shared/api');
    fetchOrgTreeMock.mockRejectedValue(new ValidationError(['performance: слишком много']));
    renderDashboard();

    expect(await screen.findByRole('alert')).toHaveTextContent(/не соответствует контракту/i);
  });

  it('во время повтора экран ошибки не сменяется скелетоном и не теряет текст', async () => {
    const user = userEvent.setup();
    let resolveRetry: ((value: OrgTreeFetchResult) => void) | undefined;

    fetchOrgTreeMock.mockRejectedValueOnce(new HttpError(500)).mockImplementationOnce(
      () =>
        new Promise<OrgTreeFetchResult>((resolve) => {
          resolveRetry = resolve;
        }),
    );

    renderDashboard();
    await screen.findByRole('alert');

    await user.click(screen.getByRole('button', { name: /повторить/i }));

    // Запрос в полёте: react-query уже сбросил status в pending и обнулил error.
    expect(screen.getByRole('alert')).toHaveTextContent(/сервер ответил ошибкой/i);
    expect(screen.queryByText(/загружаем орг-структуру/i)).not.toBeInTheDocument();

    resolveRetry?.(ok([node('div', null, 'Технологии')]));

    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('отменяет запрос при размонтировании', async () => {
    const seen: (AbortSignal | undefined)[] = [];
    fetchOrgTreeMock.mockImplementation((options) => {
      seen.push(options?.signal);
      return new Promise(() => undefined);
    });

    const { unmount } = renderDashboard();
    await waitFor(() => {
      expect(seen.length).toBeGreaterThan(0);
    });

    unmount();

    await waitFor(() => {
      expect(seen[0]?.aborted).toBe(true);
    });
  });
});
