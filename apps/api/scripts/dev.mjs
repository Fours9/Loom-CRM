/**
 * Windows-safe API dev watcher.
 * - Avoids Nest CLI `taskkill` crash on missing PID
 * - Avoids `node --watch` EADDRINUSE races on port reopen
 */
import { spawn, execSync } from 'node:child_process';
import { watch } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(apiRoot, 'package.json'));
const tscPath = require.resolve('typescript/bin/tsc');
const mainJs = path.join(apiRoot, 'dist', 'main.js');
const port = Number(process.env.PORT || 3000);

let tscWatch = null;
let appChild = null;
let restartTimer = null;
let shuttingDown = false;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pidsOnPort(listenPort) {
  try {
    const out = execSync('netstat -ano', { encoding: 'utf8' });
    const pids = new Set();
    for (const line of out.split(/\r?\n/)) {
      if (!line.includes(`:${listenPort}`) || !line.includes('LISTENING')) continue;
      const parts = line.trim().split(/\s+/);
      const pid = Number(parts[parts.length - 1]);
      if (Number.isFinite(pid) && pid > 0) pids.add(pid);
    }
    return [...pids];
  } catch {
    return [];
  }
}

function killPid(pid) {
  if (!pid || pid === process.pid) return;
  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /pid ${pid} /T /F`, { stdio: 'ignore' });
    } else {
      process.kill(pid, 'SIGTERM');
    }
  } catch {
    // already gone
  }
}

async function freePort(listenPort) {
  for (const pid of pidsOnPort(listenPort)) {
    killPid(pid);
  }
  // Give Windows a moment to release the socket.
  for (let i = 0; i < 20; i += 1) {
    if (pidsOnPort(listenPort).length === 0) return;
    await sleep(100);
  }
}

function stopApp() {
  if (!appChild) return;
  const child = appChild;
  appChild = null;
  try {
    child.kill();
  } catch {
    // ignore
  }
}

async function startApp() {
  if (shuttingDown) return;
  stopApp();
  await freePort(port);
  if (shuttingDown) return;

  appChild = spawn(process.execPath, [mainJs], {
    cwd: apiRoot,
    stdio: 'inherit',
    env: process.env,
  });

  appChild.on('exit', (code, signal) => {
    if (shuttingDown) return;
    if (signal === 'SIGTERM' || signal === 'SIGINT') return;
    // Keep watcher alive; next file change will restart.
    if (code && code !== 0) {
      console.error(`[api-dev] app exited with code ${code}`);
    }
    appChild = null;
  });
}

function scheduleRestart() {
  if (shuttingDown) return;
  clearTimeout(restartTimer);
  // Debounce tsc multi-file emit bursts.
  restartTimer = setTimeout(() => {
    void startApp();
  }, 500);
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  clearTimeout(restartTimer);
  stopApp();
  if (tscWatch && tscWatch.exitCode == null) {
    try {
      tscWatch.kill();
    } catch {
      // ignore
    }
  }
  void freePort(port).finally(() => process.exit(code));
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

const initial = spawn(process.execPath, [tscPath, '-p', 'tsconfig.build.json'], {
  cwd: apiRoot,
  stdio: 'inherit',
  env: process.env,
});

initial.on('exit', (code) => {
  if (code !== 0) {
    process.exit(code ?? 1);
  }

  tscWatch = spawn(
    process.execPath,
    [tscPath, '-p', 'tsconfig.build.json', '-w', '--preserveWatchOutput'],
    {
      cwd: apiRoot,
      stdio: 'inherit',
      env: process.env,
    },
  );

  watch(path.join(apiRoot, 'dist'), { recursive: true }, (_event, filename) => {
    if (!filename) return;
    if (!String(filename).endsWith('.js')) return;
    scheduleRestart();
  });

  void startApp();
});
