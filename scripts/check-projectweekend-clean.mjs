#!/usr/bin/env node
/**
 * Local guard: fail if ProjectWeekend copy-source has uncommitted changes.
 * Not required in cloud CI (folder may be absent).
 */
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const root = process.cwd();
const pw = join(root, 'ProjectWeekend');

if (!existsSync(pw)) {
  console.log('ProjectWeekend/ not present — skipping copy-source check.');
  process.exit(0);
}

const result = spawnSync('git', ['-C', pw, 'status', '--porcelain'], {
  encoding: 'utf8',
  shell: true,
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

const out = (result.stdout || '').trim();
if (out) {
  console.error('ProjectWeekend has local changes (read-only copy-source):');
  console.error(out);
  console.error('Do not modify ProjectWeekend as part of LoomCRM work.');
  process.exit(1);
}

console.log('ProjectWeekend is clean.');
