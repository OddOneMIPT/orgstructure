import { describe, expect, it } from 'vitest';

import { FLASH_ANIMATIONS } from './Flash';

describe('Flash', () => {
  it('фазы подсветки используют разные анимации', () => {
    // styled-components схлопывает побайтово одинаковые keyframes в одно имя.
    // Тогда чередование data-flash не меняет animation-name, браузер не
    // перезапускает анимацию, и ячейка подсвечивается только в первый раз.
    const [a, b] = FLASH_ANIMATIONS;

    expect(a.name).not.toBe(b.name);
  });
});
