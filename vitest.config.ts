import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const resolve = (relative: string) => fileURLToPath(new URL(relative, import.meta.url));

const contracts = { '@org/contracts': resolve('./packages/contracts/src/index.ts') };

/**
 * Один прогон на три окружения: клиенту нужен jsdom и его заглушки
 * (ADR 005: jsdom не умеет matchMedia/scrollIntoView/inert), серверу и контрактам — node.
 */
export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias: { '@': resolve('./apps/client/src'), ...contracts } },
        test: {
          name: 'client',
          environment: 'jsdom',
          globals: true,
          setupFiles: ['./apps/client/test/setup.ts'],
          include: ['apps/client/src/**/*.test.{ts,tsx}'],
        },
      },
      {
        resolve: { alias: contracts },
        test: {
          name: 'server',
          environment: 'node',
          globals: true,
          include: ['apps/server/src/**/*.test.ts'],
        },
      },
      {
        resolve: { alias: contracts },
        test: {
          name: 'contracts',
          environment: 'node',
          globals: true,
          include: ['packages/contracts/src/**/*.test.ts'],
        },
      },
    ],
  },
});
