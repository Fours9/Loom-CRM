#!/usr/bin/env node
/**
 * CI guard: ProjectWeekend must remain gitignored.
 * Use --no-index + trailing slash so directory-only patterns match
 * even when ProjectWeekend/ is absent from a clean CI checkout.
 */
import { spawnSync } from 'node:child_process';

const result = spawnSync(
  'git',
  ['check-ignore', '-q', '--no-index', 'ProjectWeekend/'],
  {
    encoding: 'utf8',
    shell: true,
  },
);

if (result.status !== 0) {
  console.error(
    'ProjectWeekend is NOT ignored. Keep /ProjectWeekend/ in .gitignore.',
  );
  process.exit(1);
}

console.log('ProjectWeekend is gitignored.');
