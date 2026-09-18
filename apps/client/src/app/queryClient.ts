import { QueryClient } from '@tanstack/react-query';

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        /**
         * Идентичностью модели управляют buildModel и applyPatch, а не react-query:
         * нам нужна ровно та ссылка, которую они вернули, и не нужен глубокий обход
         * на каждую запись.
         *
         * Задаётся здесь, а не в useQuery: патч через setQueryData может прийти раньше,
         * чем смонтируется компонент, и тогда применяются дефолты клиента (ADR 002).
         */
        structuralSharing: false,
        refetchOnWindowFocus: true,
        retry: 1,
      },
    },
  });
}
