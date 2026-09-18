import styled from 'styled-components';

export type PerformanceTone = 'low' | 'mid' | 'high';

export interface PerformanceBarProps {
  /** 0–100; `null` — показателя нет (пустое поддерево). */
  value: number | null;
  tone: PerformanceTone;
  className?: string;
}

const Wrapper = styled.div`
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  min-width: 0;
`;

const Track = styled.div`
  height: 6px;
  border-radius: ${({ theme }) => theme.radii.pill};
  background: ${({ theme }) => theme.colors.border};
  overflow: hidden;
`;

/**
 * Единственное разрешённое исключение из запрета интерполяций непрерывными числами (ADR 005):
 * `$pct` — целое 0–100, поэтому styled-components породит максимум 101 класс по одной
 * декларации. Альтернативы — инлайн-стиль (запрещён) или огрубление значения.
 */
const Fill = styled.div<{ $pct: number; $tone: PerformanceTone }>`
  height: 100%;
  width: ${({ $pct }) => $pct}%;
  border-radius: inherit;
  background: ${({ theme, $tone }) => theme.colors.perf[$tone].fill};
`;

const Value = styled.span<{ $tone: PerformanceTone }>`
  min-width: 4ch;
  text-align: right;
  font-variant-numeric: tabular-nums;
  font-weight: ${({ theme }) => theme.font.weight.medium};
  color: ${({ theme, $tone }) => theme.colors.perf[$tone].text};
`;

/**
 * Дорожка с заливкой и число рядом — как в макете, одинаковый и в дереве, и в таблице.
 * Цвет никогда не единственный носитель смысла: значение всегда продублировано числом.
 */
export function PerformanceBar({ value, tone, className }: PerformanceBarProps) {
  const pct = value === null ? 0 : Math.round(Math.min(100, Math.max(0, value)));

  return (
    <Wrapper
      className={className}
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      {...(value === null ? {} : { 'aria-valuenow': pct })}
      aria-valuetext={value === null ? 'нет данных' : `${pct}%`}
    >
      <Track>
        <Fill $pct={pct} $tone={tone} />
      </Track>
      <Value $tone={tone} aria-hidden>
        {value === null ? '—' : `${pct}%`}
      </Value>
    </Wrapper>
  );
}
