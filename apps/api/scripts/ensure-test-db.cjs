const { Client } = require('pg');

/**
 * Creates isolated loom_crm_test if missing (uses postgres superuser when loom lacks CREATEDB).
 * Never targets the demo/shared loom_crm app database for test data.
 */
async function main() {
  const appUrl =
    process.env.DATABASE_URL || 'postgres://loom:loom@127.0.0.1:5432/loom_crm';
  const adminUrl =
    process.env.POSTGRES_ADMIN_URL ||
    'postgres://postgres:postgres@127.0.0.1:5432/postgres';

  const admin = new Client({ connectionString: adminUrl });
  await admin.connect();
  const existing = await admin.query(
    `SELECT 1 FROM pg_database WHERE datname = 'loom_crm_test'`,
  );
  if (existing.rowCount === 0) {
    await admin.query('CREATE DATABASE loom_crm_test OWNER loom');
    console.log('created loom_crm_test (owner loom)');
  } else {
    console.log('loom_crm_test already exists');
  }
  await admin.end();

  // Smoke: loom can connect
  const testUrl =
    process.env.TEST_DATABASE_URL ||
    appUrl.replace(/\/[^/]+$/, '/loom_crm_test');
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
