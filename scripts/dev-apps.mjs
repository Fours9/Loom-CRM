/**
 * Orchestrated local API + Web start.
 * Web must not listen until API health/live is OK — avoids Vite proxy
 * ECONNREFUSED spam when `pnpm -r --parallel dev` races the Nest boot.
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const apiPort = Number(process.env.PORT || 3000);
const healthUrl =
  process.env.LOOM_DEV_HEALTH_URL ||
  `http://127.0.0.1:${apiPort}/api/v1/health/live`;
const waitMs = Number(process.env.LOOM_DEV_API_WAIT_MS || 120_000);
const pollMs = 500;

/** @type {import('node:child_process').ChildProcess[]} */
const children = [];
let shuttingDown = false;

function log(msg) {
  console.log(`[dev-apps] ${msg}`);
}

function spawnPnpm(filter, args = ['dev']) {
  // Prefer the pnpm that invoked us (`pnpm dev:apps` sets npm_execpath).
  const npmExec = process.env.npm_execpath;
  const child = npmExec
    ? spawn(process.execPath, [npmExec, '--filter', filter, ...args], {
        cwd: root,
        stdio: 'inherit',
        env: process.env,
        shell: false,
      })
    : spawn('pnpm', ['--filter', filter, ...args], {
        cwd: root,
        stdio: 'inherit',
        env: process.env,
        shell: true,
      });
  children.push(child);
  child.on('exit', (code, signal) => {
    if (shuttingDown) return;
    log(`${filter} exited (code=${code ?? 'null'} signal=${signal ?? 'null'})`);
    shutdown(code && code !== 0 ? code : 1);
  });
  return child;
}

async function waitForApi(timeoutMs) {
  const started = Date.now();
  log(`waiting for API ${healthUrl} (timeout ${timeoutMs}ms)`);
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(healthUrl);
      if (res.ok) {
        log('API health/live OK — starting web');
        return;
      }
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, pollMs));
  }
  throw new Error(
    `API did not become ready at ${healthUrl} within ${timeoutMs}ms`,
  );
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (child.exitCode != null) continue;
    try {
      if (process.platform === 'win32' && child.pid) {
        spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
          stdio: 'ignore',
          shell: true,
        });
      } else {
        child.kill('SIGTERM');
      }
    } catch {
      // already gone
    }
  }
  setTimeout(() => process.exit(code), 300).unref?.();
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

spawnPnpm('@loom/api');
try {
  await waitForApi(waitMs);
} catch (err) {
  console.error(`[dev-apps] ${err instanceof Error ? err.message : err}`);
  shutdown(1);
  throw err;
}
spawnPnpm('@loom/web');
