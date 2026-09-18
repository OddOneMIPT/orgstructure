import {
  useQuery,
  useQueryClient,
  type QueryClient,
  type UseQueryResult,
} from '@tanstack/react-query';

import { fetchOrgTree } from '@/shared/api';

import { buildModel } from './buildModel';
import type { OrgModel, Revision } from './types';

export const ORG_TREE_KEY = ['org-tree'] as const;

/** Задание: stale time 5 секунд. */
export const ORG_TREE_STALE_TIME = 5_000;

/**
 * Пока запрос был в полёте, модель могла уйти вперёд за счёт патчей (шаг 3).
 * Записать такой ответ — значит откатить уже применённое и спровоцировать новый
 * «разрыв версий», то есть зациклиться на частом тикере (ADR 002).
 */
function isOlderThanCached(
  revision: Revision | null,
  prev: OrgModel | undefined,
): prev is OrgModel {
  const cached = prev?.revision;
  if (!cached || !revision) return false;

  return cached.epoch === revision.epoch && revision.version < cached.version;
}

export async function loadOrgModel(
  queryClient: QueryClient,
  signal: AbortSignal | undefined,
): Promise<OrgModel> {
  // Прошлую модель берём из кэша: в QueryFunctionContext нет previousData,
  // а поле client появилось не во всех минорах v5 (ADR 002).
  const prev = queryClient.getQueryData<OrgModel>(ORG_TREE_KEY);

  let result = await fetchOrgTree({ signal });

  if (result.status === 'unchanged') {
    if (prev) return prev;
    // 304 без данных в кэше: просим тело заново, минуя кэш браузера.
    result = await fetchOrgTree({ signal, cache: 'reload' });
    if (result.status === 'unchanged') {
      return buildModel([], null, prev);
    }
  }

  if (isOlderThanCached(result.revision, prev)) {
    return prev;
  }

  return buildModel(result.nodes, result.revision, prev);
}

export function useOrgModel(): UseQueryResult<OrgModel> {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ORG_TREE_KEY,
    staleTime: ORG_TREE_STALE_TIME,
    retry: 1,
    // signal обязателен: именно он отменяет запрос при размонтировании.
    queryFn: ({ signal }) => loadOrgModel(queryClient, signal),
  });
}
