/**
 * Shared dependency resolution for cutover tooling.
 * Prefer packages co-located with the process (cutover image / root),
 * then fall back to apps/api (local monorepo).
 */
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const rootRequire = createRequire(import.meta.url);
const cwdRequire = createRequire(pathToFileURL(resolve(process.cwd(), 'package.json')).href);

function tryRequire(name) {
  try {
    return cwdRequire(name);
  } catch {
    try {
      return rootRequire(name);
    } catch {
      return null;
    }
  }
}

function apiRequire(name) {
  const req = createRequire(
    pathToFileURL(resolve(process.cwd(), 'apps/api/package.json')).href,
  );
  return req(name);
}

export function loadPg() {
  const mod = tryRequire('pg');
  if (mod) return mod;
  try {
    return apiRequire('pg');
  } catch {
    throw new Error('pg not found. Install pg (cutover image or apps/api).');
  }
}

export function loadUuid() {
  const mod = tryRequire('uuid');
  if (mod) return mod;
  try {
    return apiRequire('uuid');
  } catch {
    throw new Error('uuid not found. Install uuid (cutover image or apps/api).');
  }
}

export function loadBetterSqlite3() {
  const mod = tryRequire('better-sqlite3');
  if (mod) return mod;
  try {
    return apiRequire('better-sqlite3');
  } catch {
    throw new Error(
      'better-sqlite3 not found. Install at repo root: pnpm add -wD better-sqlite3 (or use cutover image).',
    );
  }
}
