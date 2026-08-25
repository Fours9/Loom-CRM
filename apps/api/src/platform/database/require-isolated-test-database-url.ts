/**
 * Guard for PostgreSQL integration specs.
 * Destructive suites (TRUNCATE) must never target demo/shared/prod DBs.
 */

const ALLOWED_TEST_DB = 'loom_crm_test';

/**
 * Allow only `loom_crm_test` or names matching `*_test` (lowercase snake).
 * Rejects `loom_crm`, `production`, `staging`, `company_crm`, etc.
 */
export function isAllowedIsolatedTestDatabaseName(dbName: string): boolean {
  if (!dbName) return false;
  if (dbName === ALLOWED_TEST_DB) return true;
  return /^[a-z][a-z0-9]*(_[a-z0-9]+)*_test$/.test(dbName);
}

export function requireIsolatedTestDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL?.trim();
  if (!url) {
    throw new Error(
      'TEST_DATABASE_URL is required for integration tests (isolated disposable DB)',
    );
  }
  const defaultUrl = process.env.DATABASE_URL?.trim();
  if (defaultUrl && urlsEqualIgnoringSlash(url, defaultUrl)) {
    throw new Error(
      'TEST_DATABASE_URL must not equal DATABASE_URL (refusing demo/shared DB)',
    );
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('TEST_DATABASE_URL is not a valid URL');
  }
  const dbName = decodeURIComponent(
    parsed.pathname.replace(/^\//, '').split('/')[0] ?? '',
  );
  if (!isAllowedIsolatedTestDatabaseName(dbName)) {
    throw new Error(
      `TEST_DATABASE_URL database must be "${ALLOWED_TEST_DB}" or match *_test (got "${dbName}")`,
    );
  }
  return url;
}

function urlsEqualIgnoringSlash(a: string, b: string): boolean {
  return a.replace(/\/$/, '') === b.replace(/\/$/, '');
}
