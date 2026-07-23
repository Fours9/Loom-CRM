#!/usr/bin/env node
/**
 * Fail if TypeORM synchronize: true appears in shared app config.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const roots = [join(process.cwd(), 'apps', 'api')];
const offenders = [];

function walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    if (name === 'node_modules' || name === 'dist') continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full);
    else if (/\.(ts|js|mjs|cjs)$/.test(name)) {
      const text = readFileSync(full, 'utf8');
      if (/synchronize\s*:\s*true/.test(text)) {
        offenders.push(full);
      }
    }
  }
}

for (const root of roots) walk(root);

if (offenders.length) {
  console.error('Found synchronize: true (forbidden):');
  for (const f of offenders) console.error(' -', f);
  process.exit(1);
}

console.log('No synchronize: true found.');
