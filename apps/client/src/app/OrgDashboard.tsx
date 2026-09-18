import { CircleAlert, FolderOpen } from 'lucide-react';
import { useMemo, useState } from 'react';
import styled from 'styled-components';

import {
  ALL_VISIBLE,
  createFilterPredicate,
  createNamePredicate,
  IntegrityError,
  selectFilteredView,
  useOrgModel,
} from '@/entities/org';
import { OrgTable } from '@/features/org-table';
import { OrgTree } from '@/features/org-tree';
import { AiFilterChips, useAiSearch } from '@/features/search';
import { HttpError, NetworkError, ValidationError } from '@/shared/api';
import { theme } from '@/shared/config/theme';
import { useDebouncedValue } from '@/shared/lib/useDebouncedValue';
import { useMediaQuery } from '@/shared/lib/useMediaQuery';
import { useKeyboardPanel, usePanelView, useSearchQuery } from '@/shared/model/dashboardStore';
import { Button, Panel, Skeleton, Spinner, StateMessage } from '@/shared/ui';

/** Задание: дебаунс фильтра 250 мс. */
const FILTER_DEBOUNCE_MS = 250;

const Content = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
  min-height: 0;
  height: 100%;
`;

const Panels = styled.div`
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: ${({ theme }) => theme.spacing.lg};

  /* Split-view: слева таблица, справа дерево (задание: ≥1280px). */
  @media (min-width: ${({ theme }) => theme.layout.split}) {
    grid-template-columns: minmax(0, 1fr) ${({ theme }) => theme.layout.treePanelWidth};
  }
`;

const Slot = styled.div`
  min-height: 0;
`;

const SkeletonList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
  align-content: start;
  padding: ${({ theme }) => theme.spacing.xl};
`;

const SkeletonRow = styled(Skeleton)<{ $wide?: boolean }>`
  width: ${({ $wide }) => ($wide ? '58%' : '36%')};
`;

const Loading = styled.p`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  margin-block-start: ${({ theme }) => theme.spacing.sm};
  color: ${({ theme }) => theme.colors.textMuted};
`;

/** Ошибка фоновой ревалидации: данные остаются на экране, сообщение их не перекрывает. */
const BackgroundError = styled.p`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
  padding: ${({ theme }) => `${theme.spacing.xs} ${theme.spacing.md}`};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radii.sm};
  background: ${({ theme }) => theme.colors.surface};
  color: ${({ theme }) => theme.colors.status.warn};
  font-size: ${({ theme }) => theme.font.size.sm};
`;

export function describeError(error: Error): { title: string; description: string } {
  if (error instanceof ValidationError) {
    return {
      title: 'Ответ сервера не соответствует контракту',
      description: `Данные пришли, но не прошли проверку схемы. ${error.issues.slice(0, 2).join('; ')}`,
    };
  }

  if (error instanceof IntegrityError) {
    return {
      title: 'Данные не образуют дерево',
      description: `${error.message}. Показать часть структуры было бы опаснее, чем честно сообщить об ошибке.`,
    };
  }

  if (error instanceof HttpError) {
    return {
      title: 'Сервер ответил ошибкой',
      description: `Код ответа ${error.status}. Попробуйте повторить запрос.`,
    };
  }

  if (error instanceof NetworkError) {
    return {
      title: 'Нет связи с сервером',
      description: 'Проверьте, запущен ли mock-сервер, и повторите попытку.',
    };
  }

  return { title: 'Не удалось загрузить данные', description: error.message };
}

export function OrgDashboard() {
  const { data: model, error, failureReason, isFetching, refetch } = useOrgModel();
  const query = useSearchQuery();
  const panelView = usePanelView();
  const keyboardPanel = useKeyboardPanel();
  const ai = useAiSearch();
  const isSplit = useMediaQuery(`(min-width: ${theme.layout.split})`);

  // Фильтруем по отложенному значению, а поле ввода живёт мгновенным.
  const debouncedQuery = useDebouncedValue(query, FILTER_DEBOUNCE_MS);

  /**
   * Разобранный AI-фильтр подставляется в тот же предикат, что и текстовый поиск,
   * поэтому фильтрует оба представления одинаково (ADR 007).
   */
  const view = useMemo(() => {
    if (!model) return null;

    const predicate =
      ai.status === 'applied'
        ? createFilterPredicate(ai.filter)
        : createNamePredicate(debouncedQuery);

    return selectFilteredView(model, predicate);
  }, [model, ai, debouncedQuery]);

  /**
   * `error` выставляется только когда попытки исчерпаны. Между ними, а также пока
   * ретрай стоит на паузе (react-query не повторяет запросы в неактивной вкладке),
   * причина сбоя лежит в `failureReason` — без неё неактивная вкладка показывала бы
   * бесконечный скелетон вместо ошибки. Проверено вживую.
   *
   * А любой новый запрос без данных обнуляет и `error`, и `failureReason`, поэтому
   * последнюю ошибку помним сами: иначе на время повтора экран ошибки сменялся бы
   * скелетоном и терял текст (ADR 002). Это штатный приём React «подправить состояние
   * во время рендера» — дешевле эффекта и без лишнего кадра.
   */
  const currentError = error ?? failureReason;
  const [lastError, setLastError] = useState<Error | null>(null);

  if (currentError && currentError !== lastError) setLastError(currentError);
  if (model && lastError) setLastError(null);

  const shownError = currentError ?? lastError;

  /**
   * Стрелки без Tab достаются одной панели: в узком режиме — видимой,
   * в split-view — той, с которой пользователь взаимодействовал последней.
   */
  const arrowsOwner = isSplit ? keyboardPanel : panelView;

  const retry = () => {
    void refetch();
  };

  if (!model && shownError) {
    const { title, description } = describeError(shownError);

    return (
      <Panel>
        <StateMessage
          role="alert"
          icon={<CircleAlert size={28} aria-hidden />}
          title={title}
          description={description}
          action={
            <Button $variant="primary" disabled={isFetching} onClick={retry}>
              {isFetching ? <Spinner size={14} /> : null}
              {isFetching ? 'Повторяем…' : 'Повторить'}
            </Button>
          }
        />
      </Panel>
    );
  }

  if (!model) {
    return (
      <Panel aria-busy>
        <SkeletonList>
          <SkeletonRow $wide />
          <SkeletonRow />
          <SkeletonRow $wide />
          <SkeletonRow />
          <SkeletonRow $wide />
          <Loading>
            <Spinner size={16} />
            Загружаем орг-структуру…
          </Loading>
        </SkeletonList>
      </Panel>
    );
  }

  if (model.byId.size === 0) {
    return (
      <Panel>
        <StateMessage
          icon={<FolderOpen size={28} aria-hidden />}
          title="Орг-структура пуста"
          description="Сервер вернул пустой список подразделений — показывать нечего."
          action={<Button onClick={retry}>Обновить</Button>}
        />
      </Panel>
    );
  }

  return (
    <Content>
      <AiFilterChips />
      {currentError ? (
        <BackgroundError role="status">
          <CircleAlert size={14} aria-hidden />
          Не удалось обновить данные, показаны последние загруженные.
        </BackgroundError>
      ) : null}
      <Panels>
        {isSplit || panelView === 'table' ? (
          <Slot>
            <OrgTable
              model={model}
              view={view ?? ALL_VISIBLE}
              claimsArrows={arrowsOwner === 'table'}
            />
          </Slot>
        ) : null}
        {isSplit || panelView === 'tree' ? (
          <Slot>
            <OrgTree
              model={model}
              view={view ?? ALL_VISIBLE}
              claimsArrows={arrowsOwner === 'tree'}
            />
          </Slot>
        ) : null}
      </Panels>
    </Content>
  );
}
