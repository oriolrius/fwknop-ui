// Dev runner: starts the backend (node --watch) and the Vite dev server together.
// No extra dependencies — just spawns both and pipes their output with a prefix.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const procs = [
  { name: 'server', color: '\x1b[33m', cmd: 'node', args: ['--watch', 'index.js'], cwd: join(root, 'server') },
  { name: 'web   ', color: '\x1b[36m', cmd: 'npm', args: ['run', 'dev', '--', '--host'], cwd: join(root, 'web') },
];

const children = procs.map(({ name, color, cmd, args, cwd }) => {
  const child = spawn(cmd, args, { cwd, shell: false });
  const tag = `${color}[${name}]\x1b[0m `;
  const pipe = (stream, out) =>
    stream.on('data', (d) =>
      out.write(d.toString().replace(/^/gm, tag).replace(new RegExp(`${tag}$`), '')),
    );
  pipe(child.stdout, process.stdout);
  pipe(child.stderr, process.stderr);
  child.on('exit', (code) => {
    process.stdout.write(`${tag}exited with code ${code}\n`);
    shutdown();
  });
  return child;
});

let shuttingDown = false;
function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const c of children) c.kill('SIGTERM');
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
