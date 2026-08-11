import { allocateNextAssignmentCode } from './assignments/questionnaire-assignment-code';

const runDb = process.env.DATABASE_URL ? describe : describe.skip;

runDb('Questionnaire assignment code allocator (live PG)', () => {
  it('two parallel allocate TX for same prefix yield distinct codes and advance counter', async () => {
    const { DataSource } = await import('typeorm');
    const ds = new DataSource({
      type: 'postgres',
      url: process.env.DATABASE_URL,
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
