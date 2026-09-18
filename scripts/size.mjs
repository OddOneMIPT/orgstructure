/**
 * Бюджет прод-сборки: ≤ 200 КБ gzip на JS + CSS (задание, шаг 04).
 * Считаем с первого шага, чтобы не узнать о превышении в последний день.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const LIMIT_BYTES = 200 * 1024;
const assetsDir = fileURLToPath(new URL('../apps/client/dist/assets', import.meta.url));

const kb = (bytes) => `${(bytes / 1024).toFixed(1)} КБ`;

let entries;
try {
  entries = await readdir(assetsDir);
} catch {
  console.error('Сборки нет. Сначала `npm run build`.');
  process.exit(1);
}

const files = entries.filter((name) => name.endsWith('.js') || name.endsWith('.css'));

if (files.length === 0) {
  console.error(`В ${assetsDir} нет JS/CSS — сборка выглядит пустой.`);
  process.exit(1);
}

const measured = await Promise.all(
  files.map(async (name) => {
    const raw = await readFile(join(assetsDir, name));
    return { name, raw: raw.byteLength, gzip: gzipSync(raw, { level: 9 }).byteLength };
  }),
);

measured.sort((a, b) => b.gzip - a.gzip);

const totalRaw = measured.reduce((sum, file) => sum + file.raw, 0);
const totalGzip = measured.reduce((sum, file) => sum + file.gzip, 0);

for (const file of measured) {
  console.log(
    `  ${file.name.padEnd(40)} ${kb(file.raw).padStart(12)} → ${kb(file.gzip).padStart(10)} gzip`,
  );
}
console.log(
  `  ${'ИТОГО'.padEnd(40)} ${kb(totalRaw).padStart(12)} → ${kb(totalGzip).padStart(10)} gzip`,
);
console.log(
  `  Бюджет: ${kb(LIMIT_BYTES)} gzip, занято ${Math.round((totalGzip / LIMIT_BYTES) * 100)}%`,
);

if (totalGzip > LIMIT_BYTES) {
  console.error(`\nПревышен бюджет: ${kb(totalGzip)} > ${kb(LIMIT_BYTES)}`);
  process.exit(1);
}
