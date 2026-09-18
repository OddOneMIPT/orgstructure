import type { ServerMessage } from '@org/contracts';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';

import { applyPatch, ORG_TREE_KEY, type OrgModel } from '@/entities/org';

import {
  createLiveConnection,
  type ConnectionState,
  type LiveConnection,
} from './createLiveConnection';

const WS_URL = (): string => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws`;
};

export interface LiveUpdates extends ConnectionState {
  retryNow: () => void;
}

/**
 * Единственный потребитель живого потока. Решения — строго по таблице из ADR 004:
 * сначала «есть ли модель», затем «та же ли эпоха», и только потом номер версии.
 */
export function useLiveUpdates(): LiveUpdates {
  const queryClient = useQueryClient();
  const [state, setState] = useState<ConnectionState>({
    status: 'connecting',
    attempt: 0,
    retryAt: null,
  });
  const connectionRef = useRef<LiveConnection | null>(null);

  useEffect(() => {
    /**
     * `cancelRefetch: false` — второй аргумент, не поле фильтра: внутри первого объекта
     * опция молча игнорируется, и частый тикер перезапускал бы запрос снова и снова.
     */
    const resync = (): void => {
      void queryClient.invalidateQueries({ queryKey: ORG_TREE_KEY }, { cancelRefetch: false });
    };

    const handle = (message: ServerMessage): void => {
      const model = queryClient.getQueryData<OrgModel>(ORG_TREE_KEY);

      // Модели ещё нет: снимок придёт с актуальной ревизией, догонять нечего.
      if (!model) return;

      // Ревизия неизвестна (ответ пришёл без разбираемого ETag) — патчи применять нельзя.
      if (!model.revision) {
        resync();
        return;
      }

      // Эпоха сравнивается раньше версии: после рестарта сервера номера несравнимы.
      if (message.type !== 'ping' && message.epoch !== model.revision.epoch) {
        resync();
        return;
      }

      if (message.type === 'reset') {
        resync();
        return;
      }

      if (message.type === 'hello') {
        if (message.version !== model.revision.version) resync();
        return;
      }

      if (message.type !== 'patch') return;

      // Дубликат или уже учтено рефетчем.
      if (message.version <= model.revision.version) return;

      // Пропуск: одним патчем догнать нельзя, нужен снимок.
      if (message.version !== model.revision.version + 1) {
        resync();
        return;
      }

      const next = applyPatch(model, message.changes, {
        epoch: message.epoch,
        version: message.version,
      });

      // `null` означает «структура разошлась». В кэш его писать нельзя: setQueryData
      // пропускает только undefined, и null осел бы там как данные (ADR 004).
      if (!next) {
        resync();
        return;
      }

      queryClient.setQueryData(ORG_TREE_KEY, next);
    };

    const connection = createLiveConnection({
      url: WS_URL(),
      onMessage: handle,
      onStatus: setState,
    });

    connectionRef.current = connection;

    return () => {
      connection.dispose();
      connectionRef.current = null;
    };
  }, [queryClient]);

  const retryNow = useCallback(() => {
    connectionRef.current?.retryNow();
  }, []);

  return { ...state, retryNow };
}
