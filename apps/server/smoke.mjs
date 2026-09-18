/**
 * Дым-проверка прод-бандла: он должен реально стартовать и отвечать.
 *
 * Без неё ошибка сборки (например, случайно вынесенный наружу `@org/contracts`)
 * всплыла бы только в контейнере — на этапе, где отлаживать дороже всего.
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const PORT = 39_321;
const bundle = fileURLToPath(new URL('./dist/index.js', import.meta.url));

const server = spawn(process.execPath, [bundle], {
  env: { ...process.env, PORT: String(PORT), TICK_INTERVAL_MS: '0' },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let log = '';
server.stdout.on('data', (chunk) => (log += chunk.toString()));
server.stderr.on('data', (chunk) => (log += chunk.toString()));

const stop = () => {
  server.kill('SIGTERM');
};

const fail = (message) => {
  stop();
  console.error(`✗ ${message}\n${log}`);
  process.exit(1);
};

server.on('exit', (code) => {
  if (code !== 0 && code !== null) fail(`бандл завершился с кодом ${code}`);
});

const deadline = Date.now() + 10_000;

for (;;) {
  if (Date.now() > deadline) fail('бандл не ответил за 10 секунд');

  try {
    const response = await fetch(`http://127.0.0.1:${PORT}/api/health`);
    if (response.ok) {
      const body = await response.json();
      stop();
      console.log(`✓ прод-бандл стартует и отвечает: ${body.nodes} узлов`);
      process.exit(0);
    }
  } catch {
    // сервер ещё поднимается
  }

  await new Promise((resolve) => setTimeout(resolve, 200));
}
