import { css } from 'styled-components';

/**
 * Никакой дизайн-системы — только токены (ADR 005). Литералов цветов, отступов
 * и таймингов в компонентах быть не должно.
 */
export const theme = {
  colors: {
    bg: '#f4f6f8',
    surface: '#ffffff',
    surfaceMuted: '#f9fafb',
    border: '#dfe3e8',
    borderStrong: '#c3cad2',
    text: '#1f2933',
    textMuted: '#69737d',
    accent: '#2f6feb',
    accentSoft: '#e8f0fe',
    focus: '#2f6feb',
    /** Подсветка обновлённой ячейки (шаг 3). */
    flash: '#fff3bf',
    perf: {
      low: { track: '#f8cecc', fill: '#d1584f', text: '#a33b34' },
      mid: { track: '#ffe6cc', fill: '#dd8c1f', text: '#8d5a0d' },
      high: { track: '#d5e8d4', fill: '#5a9e4a', text: '#38702c' },
    },
    status: {
      ok: '#3f8f2f',
      warn: '#b8860b',
      error: '#c0392b',
    },
  },

  spacing: {
    xxs: '2px',
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '24px',
    xxl: '32px',
  },

  radii: {
    sm: '4px',
    md: '8px',
    lg: '12px',
    pill: '999px',
  },

  font: {
    family:
      "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
    size: { xs: '11px', sm: '12px', md: '13px', lg: '15px', xl: '18px' },
    weight: { regular: 400, medium: 500, semibold: 600 },
  },

  timing: {
    fast: '120ms',
    base: '220ms',
    /** Затухание подсветки обновления — «около 1.5 с» из задания. */
    flash: '1500ms',
  },

  easing: 'cubic-bezier(0.2, 0, 0.2, 1)',

  /** Отступ на один уровень вложенности дерева. */
  treeIndent: 16,

  layout: {
    headerHeight: '56px',
    /** Split-view начинается отсюда (задание: ≥1280px). */
    split: '1280px',
    treePanelWidth: '420px',
  },

  shadow: {
    panel: '0 1px 2px rgba(31, 41, 51, 0.06)',
    popover: '0 6px 20px rgba(31, 41, 51, 0.16)',
  },
} as const;

export type AppTheme = typeof theme;

/**
 * Любая анимация проходит через этот хелпер: по умолчанию её нет.
 * Второе правило — ручное отключение на время массовых операций вроде
 * «Развернуть все», где десятки одновременных переходов дают джанк (ADR 005).
 *
 * Используется как тегированный шаблон: motion`transition: ...;`
 */
export const motion = (...args: Parameters<typeof css>) => css`
  @media (prefers-reduced-motion: no-preference) {
    ${css(...args)}

    [data-animate='off'] & {
      transition: none;
      animation: none;
    }
  }
`;

export const focusRing = css`
  outline: 2px solid ${({ theme: t }) => t.colors.focus};
  outline-offset: 1px;
`;
