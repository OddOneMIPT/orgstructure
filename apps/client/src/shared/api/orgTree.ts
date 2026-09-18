import { OrgTreeResponseSchema, parseRevision, type OrgNode, type Revision } from '@org/contracts';

import { HttpError, NetworkError, ValidationError } from './errors';

const DEBUG_PARAMS = ['delay', 'fail', 'empty', 'invalid'] as const;

/**
 * Отладочные параметры страницы прокидываются в запрос: `?empty=1` на адресе клиента
 * должен показывать пустое состояние. Считаются один раз при загрузке модуля —
 * если читать `location.search` на каждый вызов, URL начнёт расходиться со статичным
 * ключом запроса, и кэш будет отвечать не тем, что запрошено.
 */
function buildUrl(): string {
  if (typeof window === 'undefined') return '/api/org-tree';

  const source = new URLSearchParams(window.location.search);
  const forwarded = new URLSearchParams();

  for (const key of DEBUG_PARAMS) {
    const value = source.get(key);
    if (value !== null) forwarded.set(key, value);
  }

  const query = forwarded.toString();
  return query ? `/api/org-tree?${query}` : '/api/org-tree';
}

export const ORG_TREE_URL = buildUrl();

export type OrgTreeFetchResult =
  | { status: 'ok'; nodes: OrgNode[]; revision: Revision | null }
  /** Сервер подтвердил, что данные не изменились (304). Тела нет. */
  | { status: 'unchanged' };

export interface FetchOrgTreeOptions {
  signal?: AbortSignal;
  /**
   * `reload` заставляет пройти мимо кэша браузера. Нужен, когда WS сообщил о разрыве версий:
   * слой, отдающий тело без ревалидации, иначе вернул бы ту же устаревшую ревизию,
   * и рефетч зациклился бы (ADR 002).
   */
  cache?: RequestCache;
}

export async function fetchOrgTree({
  signal,
  cache,
}: FetchOrgTreeOptions = {}): Promise<OrgTreeFetchResult> {
  let response: Response;

  try {
    response = await fetch(ORG_TREE_URL, {
      signal: signal ?? null,
      cache: cache ?? 'default',
      headers: { Accept: 'application/json' },
    });
  } catch (error) {
    // Отмену пробрасываем как есть: react-query обязан отличать её от сетевого сбоя.
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new NetworkError(error);
  }

  // 304 разбираем ДО response.ok: у него ok === false, и иначе «ничего не изменилось»
  // превратилось бы в экран ошибки. В браузере его обычно не видно, но он приходит
  // в Node/undici — то есть в тестах и при ручной проверке.
  if (response.status === 304) {
    return { status: 'unchanged' };
  }

  if (!response.ok) {
    throw new HttpError(response.status);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ValidationError(['тело ответа не является JSON']);
  }

  const parsed = OrgTreeResponseSchema.safeParse(payload);
  if (!parsed.success) {
    throw new ValidationError(
      parsed.error.issues.map((issue) => `${issue.path.join('.') || 'корень'}: ${issue.message}`),
    );
  }

  return {
    status: 'ok',
    nodes: parsed.data,
    revision: parseRevision(response.headers.get('ETag')),
  };
}
