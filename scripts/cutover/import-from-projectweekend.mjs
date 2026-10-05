#!/usr/bin/env node
/**
 * CLI entry for ProjectWeekend SQLite → LoomCRM PostgreSQL port.
 *
 *   node scripts/cutover/import-from-projectweekend.mjs --dry-run
 *   node scripts/cutover/import-from-projectweekend.mjs --reset
 *
 * Never writes to ProjectWeekend. See docs/dev/pw-to-loom-port.md
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { runPort } from './orchestrator.mjs';

function arg(name, fallback = null) {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return fallback;
  return process.argv[idx + 1] ?? true;
}

const dryRun = process.argv.includes('--dry-run');
const reset = process.argv.includes('--reset');
const sqlitePath = resolve(
  String(arg('--sqlite', resolve(process.cwd(), 'ProjectWeekend/data/app.sqlite'))),
);
const databaseUrl =
  (typeof arg('--database-url') === 'string' ? arg('--database-url') : null) ||
  process.env.DATABASE_URL ||
  'postgres://loom:loom@127.0.0.1:5432/loom_crm';

async function main() {
  if (!existsSync(sqlitePath)) {
    console.error(`SQLite file not found: ${sqlitePath}`);
    process.exit(2);
  }

  try {
    const result = await runPort({
      sqlitePath,
      databaseUrl,
      dryRun,
      reset: reset || false,
    });
    process.exit(result.exitCode);
  } catch (e) {
    if (e && e.message && String(e.message).includes('better-sqlite3')) {
      console.error(e.message);
      process.exit(2);
    }
    console.error(e);
    process.exit(1);
  }
}

main();
