import { spawn } from 'node:child_process';

// Accept both Next and generic preview-host flags without changing Next's server.
const args = process.argv.slice(2).flatMap((arg) =>
  arg === '--host' ? ['--hostname'] : arg === '--strictPort' ? [] : [arg],
);
const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', ...args], {
  stdio: 'inherit',
});
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => child.kill(signal));
child.on('exit', (code) => process.exit(code ?? 1));
