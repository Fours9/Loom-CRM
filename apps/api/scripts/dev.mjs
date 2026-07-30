/**
 * Windows-safe API dev watcher.
 * - One Nest at a time (mutex + kill listeners on :PORT)
 * - Restart only after tsc -w reports a clean compile (no fs.watch race)
 * - No wmic (removed on modern Windows)
 */
import { spawn, execSync } from 'node:child_process';
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
let startInFlight = null;
let startEpoch = 0;
let pendingRestart = false;

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

function orphanMainPids() {
  if (process.platform !== 'win32') return [];
  try {
    const script = [
      "$ErrorActionPreference='SilentlyContinue'",
      "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" |",
      '  Where-Object { $_.CommandLine -and $_.CommandLine -like \'*%LOOM%*main.js*\' } |',
      '  ForEach-Object { $_.ProcessId }',
    ]
      .join(' ')
      .replace('%LOOM%', 'Loom-CRM-Core');
    const out = execSync(`powershell -NoProfile -Command ${JSON.stringify(script)}`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return out
      .split(/\r?\n/)
      .map((s) => Number(s.trim()))
      .filter((pid) => Number.isFinite(pid) && pid > 0 && pid !== process.pid);
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
  const victims = new Set([...pidsOnPort(listenPort), ...orphanMainPids()]);
  if (appChild?.pid) victims.add(appChild.pid);
  for (const pid of victims) killPid(pid);
  for (let i = 0; i < 40; i += 1) {
    if (pidsOnPort(listenPort).length === 0) return;
    await sleep(100);
  }
}

function stopApp() {
  if (!appChild) return;
  const child = appChild;
  appChild = null;
  if (child.pid) killPid(child.pid);
  else {
    try {
      child.kill();
    } catch {
      // ignore
    }
  }
}

async function waitUntilListening(listenPort, epoch, timeoutMs = 25000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (shuttingDown || epoch !== startEpoch) return false;
    if (pidsOnPort(listenPort).length > 0) return true;
    if (appChild && appChild.exitCode != null) return false;
    await sleep(150);
  }
  return pidsOnPort(listenPort).length > 0;
}

async function startAppUnlocked() {
  if (shuttingDown) return;
  const epoch = ++startEpoch;
  stopApp();
  await freePort(port);
  if (shuttingDown || epoch !== startEpoch) return;

  const child = spawn(process.execPath, [mainJs], {
    cwd: apiRoot,
    stdio: 'inherit',
    env: process.env,
  });
  appChild = child;

  child.on('exit', (code, signal) => {
    if (appChild !== child) return;
    appChild = null;
    if (shuttingDown) return;
    if (signal === 'SIGTERM' || signal === 'SIGINT') return;
    if (code && code !== 0) {
      console.error(`[api-dev] app exited with code ${code}`);
    }
  });

  const ok = await waitUntilListening(port, epoch);
  if (!ok && epoch === startEpoch && !shuttingDown) {
    console.error(`[api-dev] timed out waiting for port ${port}`);
  } else if (ok && epoch === startEpoch) {
    console.log(`[api-dev] listening on :${port} (pid ${child.pid})`);
  }
}

function startApp() {
  if (shuttingDown) return Promise.resolve();
  if (startInFlight) {
    pendingRestart = true;
    return startInFlight;
  }
  startInFlight = (async () => {
    do {
      pendingRestart = false;
      await startAppUnlocked();
    } while (pendingRestart && !shuttingDown);
  })().finally(() => {
    startInFlight = null;
  });
  return startInFlight;
}

function scheduleRestart(reason) {
  if (shuttingDown) return;
  clearTimeout(restartTimer);
  restartTimer = setTimeout(() => {
    console.log(`[api-dev] restart (${reason})`);
    void startApp();
  }, 1000);
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
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    },
  );

  let tscBuf = '';
  const onTscChunk = (chunk) => {
    const text = String(chunk);
    process.stdout.write(text);
    tscBuf += text;
    if (tscBuf.length > 8000) tscBuf = tscBuf.slice(-4000);
    // Fresh successful watch compile → restart app once.
    if (/Found 0 errors\. Watching for file changes\./.test(tscBuf)) {
      tscBuf = '';
      scheduleRestart('tsc');
    }
  };
  tscWatch.stdout.on('data', onTscChunk);
  tscWatch.stderr.on('data', onTscChunk);

  // First boot (do not wait for tsc -w echo — dist already built by initial tsc).
  scheduleRestart('boot');
});
