import { spawn } from 'node:child_process';
import { realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const supportDir = path.dirname(fileURLToPath(import.meta.url));
// Rollup cannot relativize paths across Windows drive letters. Resolve a
// junction-backed workspace before starting Vite so cwd and module paths agree.
const siteDir = realpathSync(path.resolve(supportDir, '..', '..'));
const viteCli = path.join(siteDir, 'node_modules', 'vite', 'bin', 'vite.js');
const [command = 'dev', ...forwarded] = process.argv.slice(2);
const viteArgs = command === 'dev' ? forwarded : [command, ...forwarded];

const child = spawn(process.execPath, [viteCli, ...viteArgs], {
  cwd: siteDir,
  env: process.env,
  shell: false,
  stdio: 'inherit',
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal));
}

child.once('error', error => {
  console.error(error);
  process.exitCode = 1;
});
child.once('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exitCode = code ?? 1;
});
