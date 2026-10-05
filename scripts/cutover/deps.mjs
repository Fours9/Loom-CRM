/**
 * Shared dependency resolution for cutover tooling.
 * pg + uuid come from apps/api (no new root deps). better-sqlite3 from root.
 */
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const rootRequire = createRequire(import.meta.url);
const apiRequire = createRequire(
  pathToFileURL(resolve(process.cwd(), 'apps/api/package.json')).href,
);

export function loadPg() {
  return apiRequire('pg');
}

export function loadUuid() {
  return apiRequire('uuid');
}

export function loadBetterSqlite3() {
  try {
    return rootRequire('better-sqlite3');
  } catch {
    try {
      return apiRequire('better-sqlite3');
    } catch {
      throw new Error(
        'better-sqlite3 not found. Install at repo root: pnpm add -wD better-sqlite3',
      );
    }
  }
}
