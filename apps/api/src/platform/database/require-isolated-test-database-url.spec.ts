import {
  isAllowedIsolatedTestDatabaseName,
  requireIsolatedTestDatabaseUrl,
} from './require-isolated-test-database-url';

describe('requireIsolatedTestDatabaseUrl', () => {
  const prevTest = process.env.TEST_DATABASE_URL;
  const prevDb = process.env.DATABASE_URL;

  afterEach(() => {
    if (prevTest === undefined) delete process.env.TEST_DATABASE_URL;
    else process.env.TEST_DATABASE_URL = prevTest;
    if (prevDb === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = prevDb;
  });

  it('allows loom_crm_test', () => {
    process.env.TEST_DATABASE_URL =
      'postgres://loom:loom@127.0.0.1:5432/loom_crm_test';
    delete process.env.DATABASE_URL;
    expect(requireIsolatedTestDatabaseUrl()).toContain('loom_crm_test');
  });

  it('allows other *_test names', () => {
    expect(isAllowedIsolatedTestDatabaseName('ci_catalog_test')).toBe(true);
  });

  it('rejects loom_crm, production, staging, company_crm', () => {
    expect(isAllowedIsolatedTestDatabaseName('loom_crm')).toBe(false);
    expect(isAllowedIsolatedTestDatabaseName('production')).toBe(false);
    expect(isAllowedIsolatedTestDatabaseName('staging')).toBe(false);
    expect(isAllowedIsolatedTestDatabaseName('company_crm')).toBe(false);
  });

  it('rejects TEST_DATABASE_URL equal to DATABASE_URL', () => {
    const url = 'postgres://loom:loom@127.0.0.1:5432/loom_crm_test';
    process.env.TEST_DATABASE_URL = url;
    process.env.DATABASE_URL = url;
    expect(() => requireIsolatedTestDatabaseUrl()).toThrow(/must not equal/);
  });

  it('rejects production-like DB names even when URL differs from DATABASE_URL', () => {
    process.env.DATABASE_URL = 'postgres://loom:loom@127.0.0.1:5432/loom_crm';
    process.env.TEST_DATABASE_URL =
      'postgres://loom:loom@127.0.0.1:5432/production';
    expect(() => requireIsolatedTestDatabaseUrl()).toThrow(/must be/);
  });
});
