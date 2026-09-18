/**
 * Прод-сборка сервера: один файл, в который вбандлен source-only пакет контрактов.
 *
 * Внешние зависимости перечисляются **явно**, а не флагом `--packages=external`:
 * тот вынес бы наружу и `@org/contracts`, и Node в контейнере попытался бы
 * импортировать `.ts` (ADR 001). Всё, что не перечислено, попадает в бандл.
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const here = (relative) => fileURLToPath(new URL(relative, import.meta.url));

const manifest = JSON.parse(await readFile(here('./package.json'), 'utf8'));

const external = Object.keys(manifest.dependencies ?? {}).filter(
  (name) => name !== '@org/contracts',
);

await build({
  entryPoints: [here('./src/main.ts')],
  outfile: here('./dist/index.js'),
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  sourcemap: false,
  minify: false,
  external,
  banner: {
    // Некоторые зависимости ждут CJS-овый require; в ESM-бандле его нужно создать.
    js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
  },
  alias: {
    '@org/contracts': here('../../packages/contracts/src/index.ts'),
  },
  logLevel: 'info',
});
