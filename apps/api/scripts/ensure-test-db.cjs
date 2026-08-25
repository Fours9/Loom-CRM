const { Client } = require('pg');

/**
 * Ensures isolated loom_crm_test exists for destructive integration specs.
 * Default admin: same credentials as DATABASE_URL, database `postgres`
 * (Compose POSTGRES_USER=loom can CREATE DATABASE).
 * If that fails, set explicit POSTGRES_ADMIN_URL.
 */
function derivePostgresMaintenanceUrl(appUrl) {
  const u = new URL(appUrl);
  u.pathname = '/postgres';
  return u.toString();
}

async function tryCreate(adminUrl, ownerHint) {
  const admin = new Client({ connectionString: adminUrl });
  await admin.connect();
  try {
    const existing = await admin.query(
      `SELECT 1 FROM pg_database WHERE datname = 'loom_crm_test'`,
    );
    if (existing.rowCount === 0) {
      const owner = String(ownerHint || 'loom').replace(/[^a-zA-Z0-9_]/g, '');
      if (!owner) {
        throw new Error('Cannot determine safe DB owner for loom_crm_test');
      }
      await admin.query(`CREATE DATABASE loom_crm_test OWNER "${owner}"`);
      console.log(`created loom_crm_test (owner ${owner})`);
    } else {
      console.log('loom_crm_test already exists');
    }
  } finally {
    await admin.end();
  }
}

async function main() {
  const appUrl =
    process.env.DATABASE_URL || 'postgres://loom:loom@127.0.0.1:5432/loom_crm';
  const derivedAdmin = derivePostgresMaintenanceUrl(appUrl);
  const ownerFromUrl = (() => {
    try {
      return decodeURIComponent(new URL(appUrl).username) || 'loom';
    } catch {
      return 'loom';
    }
  })();

  if (process.env.POSTGRES_ADMIN_URL?.trim()) {
    await tryCreate(process.env.POSTGRES_ADMIN_URL.trim(), ownerFromUrl);
  } else {
    try {
      await tryCreate(derivedAdmin, ownerFromUrl);
    } catch (err) {
      console.error(
        'Failed to create loom_crm_test using DATABASE_URL credentials on /postgres.',
      );
      console.error(
        'Set POSTGRES_ADMIN_URL to a role with CREATEDB (Compose default loom usually works).',
      );
      throw err;
    }
  }

  const testUrl =
    process.env.TEST_DATABASE_URL ||
    appUrl.replace(/\/[^/?#]+(?=[?#]|$)/, '/loom_crm_test');
  const probe = new Client({ connectionString: testUrl });
  await probe.connect();
  await probe.query('SELECT 1');
  await probe.end();
  console.log('TEST_DATABASE_URL ready:', testUrl.replace(/:[^:@]+@/, ':***@'));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
