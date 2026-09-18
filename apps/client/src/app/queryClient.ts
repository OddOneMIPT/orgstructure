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
        /**
         * Свежесть обеспечивает WebSocket: патчи приходят сами, а после переподключения
         * `hello` сверяет ревизию и при расхождении вызывает ровно один рефетч.
         * Рефетч по фокусу окна в такой схеме только добавляет запросы (задание требует
         * их избегать), а когда поток недоступен — это видно в индикаторе соединения,
         * и рядом есть кнопка «Подключиться сейчас».
         */
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });
}
