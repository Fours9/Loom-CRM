#!/usr/bin/env node
/**
 * Fail-safe questionnaire test-data reset.
 *
 *   pnpm questionnaires:reset
 *     → dry-run: print DB host/name + row counts
 *
 *   ALLOW_QUESTIONNAIRE_TEST_RESET=YES pnpm questionnaires:reset -- --execute
 *     → DELETE proposals/submissions/responses/assignments in one transaction
 *
 * Guards:
 *   - NODE_ENV=production → always refuse
 *   - --execute requires ALLOW_QUESTIONNAIRE_TEST_RESET=YES
 * Never called from app startup/deploy.
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const require = createRequire(resolve(root, 'apps/api/package.json'));
const pg = require('pg');

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL?.trim()) return process.env.DATABASE_URL.trim();
  const envPath = resolve(root, '.env');
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      if (!line || line.trim().startsWith('#') || !line.includes('=')) continue;
      const [k, ...rest] = line.split('=');
      if (k.trim() === 'DATABASE_URL') {
        return rest.join('=').trim().replace(/^['"]|['"]$/g, '');
      }
    }
  }
  return 'postgres://loom:loom@127.0.0.1:5432/loom_crm';
}

function parseArgs(argv) {
  return {
    execute: argv.includes('--execute'),
  };
}

async function counts(client) {
  const tables = [
    'questionnaire_profile_proposals',
    'questionnaire_submissions',
    'questionnaire_responses',
    'questionnaire_assignments',
  ];
  const out = {};
  for (const t of tables) {
    const r = await client.query(`SELECT COUNT(*)::int AS c FROM ${t}`);
    out[t] = r.rows[0].c;
  }
  return out;
}

async function main() {
  const { execute } = parseArgs(process.argv.slice(2));
  const nodeEnv = process.env.NODE_ENV || 'development';

  if (nodeEnv === 'production') {
    console.error('Refusing: NODE_ENV=production (questionnaire test reset forbidden).');
    process.exit(1);
  }

  if (execute && process.env.ALLOW_QUESTIONNAIRE_TEST_RESET !== 'YES') {
    console.error(
      'Refusing execute: set ALLOW_QUESTIONNAIRE_TEST_RESET=YES and pass --execute.',
    );
    process.exit(1);
  }

  const url = loadDatabaseUrl();
  let host = '(unknown)';
  let database = '(unknown)';
  try {
    const u = new URL(url);
    host = u.hostname;
    database = u.pathname.replace(/^\//, '') || '(default)';
  } catch {
    /* ignore */
  }

  const client = new pg.Client({ connectionString: url });
  await client.connect();

  try {
    const before = await counts(client);
    console.log(`Database host=${host} name=${database} NODE_ENV=${nodeEnv}`);
    console.log('Counts:', before);

    if (!execute) {
      console.log('Dry-run only. Re-run with ALLOW_QUESTIONNAIRE_TEST_RESET=YES -- --execute to delete.');
      return;
    }

    console.log('Executing DELETE in one transaction…');
    await client.query('BEGIN');
    try {
      await client.query('DELETE FROM questionnaire_profile_proposals');
      await client.query('DELETE FROM questionnaire_submissions');
      await client.query('DELETE FROM questionnaire_responses');
      await client.query('DELETE FROM questionnaire_assignments');
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }

    const after = await counts(client);
    console.log('Counts after:', after);
    const leftover = Object.values(after).some((c) => c !== 0);
    if (leftover) {
      console.error('ERROR: non-zero counts after reset');
      process.exit(1);
    }
    console.log('Reset OK. Restart API to refresh employee-360 v1 seed, then run scripts/db-snapshot.ps1.');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
