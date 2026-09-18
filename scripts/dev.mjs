/**
 * Одна команда поднимает сервер и клиент (задание: «запуск одной командой»).
 * Отдельная зависимость вроде concurrently ради этого не нужна.
 */
import { spawn } from 'node:child_process';

const targets = [
  { name: 'server', workspace: 'apps/server', color: '[36m' },
  { name: 'client', workspace: 'apps/client', color: '[35m' },
];

const reset = '[0m';
const children = [];
let shuttingDown = false;

const prefixLines = (chunk, name, color) =>
  chunk
    .toString()
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => `${color}[${name}]${reset} ${line}`)
    .join('\n');

const shutdown = (code) => {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) child.kill('SIGTERM');
  process.exit(code);
};

for (const { name, workspace, color } of targets) {
  const child = spawn('npm', ['run', 'dev', '--workspace', workspace], {
    stdio: ['inherit', 'pipe', 'pipe'],
  });

  child.stdout.on('data', (chunk) => {
    const text = prefixLines(chunk, name, color);
    if (text) console.log(text);
  });
  child.stderr.on('data', (chunk) => {
    const text = prefixLines(chunk, name, color);
    if (text) console.error(text);
  });
  child.on('exit', (code) => {
    if (!shuttingDown) {
      console.error(`${color}[${name}]${reset} завершился с кодом ${code ?? 'null'}`);
      shutdown(code ?? 1);
    }
  });

  children.push(child);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
