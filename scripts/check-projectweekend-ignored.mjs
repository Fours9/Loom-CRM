#!/usr/bin/env node
/**
 * CI guard: ProjectWeekend must remain gitignored.
 */
import { spawnSync } from 'node:child_process';

const result = spawnSync('git', ['check-ignore', '-q', 'ProjectWeekend'], {
  encoding: 'utf8',
  shell: true,
});

if (result.status !== 0) {
  console.error(
    'ProjectWeekend is NOT ignored. Keep /ProjectWeekend/ in .gitignore.',
  );
  process.exit(1);
}

console.log('ProjectWeekend is gitignored.');
