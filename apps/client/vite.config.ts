import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const resolve = (relative: string) => fileURLToPath(new URL(relative, import.meta.url));

const serverPort = process.env.SERVER_PORT ?? '3000';
const serverOrigin = `http://localhost:${serverPort}`;

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve('./src'),
      '@org/contracts': resolve('../../packages/contracts/src/index.ts'),
    },
  },
  server: {
    port: 8080,
    // Порт фиксирован: без этого Vite молча уезжает на соседний, и ссылки в README врут.
    strictPort: true,
    // Тот же origin, что в проде за Nginx: без CORS и с доступным заголовком ETag.
    // Путь `/` не проксируем — там живёт HMR-сокет самого Vite.
    proxy: {
      '/api': { target: serverOrigin },
      '/ws': { target: serverOrigin, ws: true },
    },
  },
  build: {
    target: 'es2023',
    sourcemap: false,
  },
});
