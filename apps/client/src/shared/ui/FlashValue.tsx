import { useFlash } from '@/shared/lib/useFlash';

import { Flash } from './Flash';

export interface FlashValueProps {
  /** Значение, по изменению которого запускается подсветка. */
  value: number | string | null;
  children: React.ReactNode;
  className?: string;
}

/** Подсвечивает содержимое, когда значение изменилось живым обновлением. */
export function FlashValue({ value, children, className }: FlashValueProps) {
  const phase = useFlash(value);

  return (
    <Flash className={className} {...(phase === null ? {} : { 'data-flash': phase })}>
      {children}
    </Flash>
  );
}
