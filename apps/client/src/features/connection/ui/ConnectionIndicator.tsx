import { Wifi, WifiOff } from 'lucide-react';
import { useCallback, useSyncExternalStore } from 'react';
import styled from 'styled-components';

import { Button, Spinner } from '@/shared/ui';

import type { ConnectionStatus } from '../model/createLiveConnection';
import { useLiveUpdates } from '../model/useLiveUpdates';

const Wrapper = styled.div`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
  font-size: ${({ theme }) => theme.font.size.sm};
  color: ${({ theme }) => theme.colors.textMuted};
  white-space: nowrap;

  &[data-status='open'] {
    color: ${({ theme }) => theme.colors.status.ok};
  }

  &[data-status='reconnecting'],
  &[data-status='offline'] {
    color: ${({ theme }) => theme.colors.status.error};
  }
`;

const Countdown = styled.span`
  font-variant-numeric: tabular-nums;
`;

const LABELS: Record<ConnectionStatus, string> = {
  connecting: 'Подключение',
  open: 'Обновления в реальном времени',
  reconnecting: 'Нет соединения',
  offline: 'Нет сети',
};

/**
 * Секунды до следующей попытки — чтобы ожидание не выглядело зависанием.
 *
 * Часы — внешний изменяемый источник, поэтому читаются через `useSyncExternalStore`,
 * а не вызовом `Date.now()` прямо в рендере: это ровно тот случай, для которого хук
 * и существует.
 */
function useSecondsLeft(retryAt: number | null): number | null {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (retryAt === null) return () => undefined;

      const timer = setInterval(onChange, 500);
      return () => {
        clearInterval(timer);
      };
    },
    [retryAt],
  );

  const getSnapshot = useCallback(
    () => (retryAt === null ? null : Math.max(0, Math.ceil((retryAt - Date.now()) / 1000))),
    [retryAt],
  );

  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}

/**
 * Состояние потока обновлений в шапке. `role="status"` — чтобы смена состояния
 * доходила и до скринридера, а не только до глаз.
 */
export function ConnectionIndicator() {
  const { status, retryAt, retryNow } = useLiveUpdates();
  const secondsLeft = useSecondsLeft(retryAt);

  const isDown = status === 'reconnecting' || status === 'offline';

  return (
    <Wrapper data-status={status} role="status">
      {status === 'connecting' ? <Spinner size={14} /> : null}
      {status === 'open' ? <Wifi size={14} aria-hidden /> : null}
      {isDown ? <WifiOff size={14} aria-hidden /> : null}

      <span>{LABELS[status]}</span>

      {isDown && secondsLeft !== null ? (
        <Countdown>· повтор через {secondsLeft} с</Countdown>
      ) : null}

      {isDown ? (
        <Button $variant="ghost" onClick={retryNow}>
          Подключиться сейчас
        </Button>
      ) : null}
    </Wrapper>
  );
}
