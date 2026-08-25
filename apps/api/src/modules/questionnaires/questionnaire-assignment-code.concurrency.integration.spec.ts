import { DataSource } from 'typeorm';
import { allocateNextAssignmentCode } from './assignments/questionnaire-assignment-code';
import { requireIsolatedTestDatabaseUrl } from '../../platform/database/require-isolated-test-database-url';

/**
 * Live PostgreSQL concurrency for assignment code allocator.
 * Requires migrated TEST_DATABASE_URL (loom_crm_test).
 */
describe('Questionnaire assignment code allocator (integration)', () => {
  it('two parallel allocate TX for same prefix yield distinct codes and advance counter', async () => {
    const url = requireIsolatedTestDatabaseUrl();
    const ds = new DataSource({
      type: 'postgres',
      url,
      synchronize: false,
    });
    await ds.initialize();

    const prefix = `T${Date.now().toString(36).slice(-6).toUpperCase()}`;

    try {
      await ds.query(
        `INSERT INTO questionnaire_assignment_code_counters ("prefix", "next_value")
         VALUES ($1, 6)
         ON CONFLICT ("prefix") DO UPDATE SET "next_value" = 6`,
        [prefix],
      );

      const [codeA, codeB] = await Promise.all([
        ds.transaction((manager) =>
          allocateNextAssignmentCode(manager, prefix),
        ),
        ds.transaction((manager) =>
          allocateNextAssignmentCode(manager, prefix),
        ),
      ]);

      expect(codeA).not.toBe(codeB);
      expect([codeA, codeB].sort()).toEqual(
        [`${prefix}-006`, `${prefix}-007`].sort(),
      );

      const rows = await ds.query(
        `SELECT next_value AS "nextValue"
         FROM questionnaire_assignment_code_counters
         WHERE prefix = $1`,
        [prefix],
      );
      expect(Number(rows[0]?.nextValue)).toBe(8);
    } finally {
      await ds.query(
        `DELETE FROM questionnaire_assignment_code_counters WHERE prefix = $1`,
        [prefix],
      );
      await ds.destroy();
    }
  });
});
