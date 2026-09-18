import { buildServer } from './app.js';
import { env } from './env.js';

const server = await buildServer();

try {
  await server.listen({ port: env.PORT, host: env.HOST });
} catch (error) {
  server.log.error(error);
  process.exit(1);
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    void server.close().then(() => {
      process.exit(0);
    });
  });
}
