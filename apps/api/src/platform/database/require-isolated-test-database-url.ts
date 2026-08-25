/**
 * Guard for PostgreSQL integration specs.
 * Never use the normal local/demo/shared loom_crm DATABASE_URL.
 */
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
  const dbName = parsed.pathname.replace(/^\//, '').split('/')[0] ?? '';
  if (dbName === 'loom_crm') {
    throw new Error(
      'TEST_DATABASE_URL must not target loom_crm; use an isolated DB (e.g. loom_crm_test)',
    );
  }
  return url;
}

function urlsEqualIgnoringSlash(a: string, b: string): boolean {
  return a.replace(/\/$/, '') === b.replace(/\/$/, '');
}
