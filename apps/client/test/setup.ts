import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

/**
 * jsdom не реализует эти API, а обращение к ним бросает (ADR 005).
 * Компоненты не должны об этом знать — заглушки ставим один раз здесь.
 */
if (!window.matchMedia) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

Object.defineProperty(Element.prototype, 'scrollIntoView', {
  value: vi.fn(),
  writable: true,
  configurable: true,
});

afterEach(() => {
  cleanup();
});
