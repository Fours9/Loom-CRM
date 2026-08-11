import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * CASCADE for hard-delete is enforced by FK definitions in the questionnaires migration.
 * Full live-DB aggregate wipe is covered when DATABASE_URL is available (see below).
 */
describe('Questionnaire assignment hard-delete CASCADE contract', () => {
  const migration = readFileSync(
    join(
      __dirname,
      '../../platform/database/migrations/1730000011000-QuestionnairesModule.ts',
    ),
    'utf8',
  );

  it('defines assignment → response → submission → proposal ON DELETE CASCADE', () => {
    expect(migration).toMatch(
      /FK_questionnaire_responses_assignment[\s\S]*?ON DELETE CASCADE/,
    );
    expect(migration).toMatch(
      /FK_questionnaire_submissions_response[\s\S]*?ON DELETE CASCADE/,
    );
    expect(migration).toMatch(
      /FK_questionnaire_profile_proposals_submission[\s\S]*?ON DELETE CASCADE/,
    );
  });
});

const runDb = process.env.DATABASE_URL ? describe : describe.skip;

runDb('Questionnaire assignment hard-delete (live DB)', () => {
  // Optional: requires migrated DATABASE_URL. Inserts minimal aggregate, deletes assignment,
  // asserts questionnaire rows gone while a pre-set employee.city remains.
  it('wipes questionnaire aggregate and does not rollback applied profile city', async () => {
    const { DataSource } = await import('typeorm');
    const ds = new DataSource({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      synchronize: false,
    });
    await ds.initialize();
    const qr = ds.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      const emp = await qr.query(
        `SELECT id, city FROM employees ORDER BY created_at ASC LIMIT 1`,
      );
      if (!emp.length) {
        return;
      }
      const employeeId = emp[0].id as string;
      const originalCity = emp[0].city as string | null;
      const markerCity = `cascade-test-${Date.now()}`;
      await qr.query(`UPDATE employees SET city = $1 WHERE id = $2`, [
        markerCity,
        employeeId,
      ]);

      const versions = await qr.query(
        `SELECT id FROM questionnaire_template_versions ORDER BY version DESC LIMIT 1`,
      );
      if (!versions.length) {
        return;
      }
      const versionId = versions[0].id as string;
      const users = await qr.query(
        `SELECT id FROM users ORDER BY created_at ASC LIMIT 1`,
      );
      const actorId = users[0]?.id as string;

      const [assignment] = await qr.query(
        `INSERT INTO questionnaire_assignments
          (template_version_id, employee_id, assigned_by_user_id, status, code)
         VALUES ($1, $2, $3, 'assigned', $4)
         RETURNING id`,
        [versionId, employeeId, actorId, `TST-${Date.now()}`],
      );
      const assignmentId = assignment.id as string;

      const [response] = await qr.query(
        `INSERT INTO questionnaire_responses (assignment_id, answers_json, revision)
         VALUES ($1, '{}'::jsonb, 0)
         RETURNING id`,
        [assignmentId],
      );
      const responseId = response.id as string;

      const [sub1] = await qr.query(
        `INSERT INTO questionnaire_submissions
          (response_id, submission_number, snapshot_json, submitted_by_user_id, submitted_at, review_status)
         VALUES ($1, 1, '{}'::jsonb, $2, NOW(), 'pending')
         RETURNING id`,
        [responseId, actorId],
      );
      const [sub2] = await qr.query(
        `INSERT INTO questionnaire_submissions
          (response_id, submission_number, snapshot_json, submitted_by_user_id, submitted_at, review_status)
         VALUES ($1, 2, '{}'::jsonb, $2, NOW(), 'pending')
         RETURNING id`,
        [responseId, actorId],
      );

      await qr.query(
        `INSERT INTO questionnaire_profile_proposals
          (submission_id, employee_id, target_section, proposed_changes, status)
         VALUES
          ($1, $3, 'identity', '{"field":"city"}'::jsonb, 'pending'),
          ($2, $3, 'identity', '{"field":"city"}'::jsonb, 'accepted')`,
        [sub1.id, sub2.id, employeeId],
      );

      await qr.query(`DELETE FROM questionnaire_assignments WHERE id = $1`, [
        assignmentId,
      ]);

      const left = await qr.query(
        `SELECT
           (SELECT COUNT(*)::int FROM questionnaire_responses WHERE assignment_id = $1) AS responses,
           (SELECT COUNT(*)::int FROM questionnaire_submissions WHERE response_id = $2) AS submissions,
           (SELECT COUNT(*)::int FROM questionnaire_profile_proposals WHERE submission_id IN ($3, $4)) AS proposals`,
        [assignmentId, responseId, sub1.id, sub2.id],
      );
      expect(left[0].responses).toBe(0);
      expect(left[0].submissions).toBe(0);
      expect(left[0].proposals).toBe(0);

      const [{ city }] = await qr.query(
        `SELECT city FROM employees WHERE id = $1`,
        [employeeId],
      );
      expect(city).toBe(markerCity);

      await qr.query(`UPDATE employees SET city = $1 WHERE id = $2`, [
        originalCity,
        employeeId,
      ]);
    } finally {
      await qr.rollbackTransaction();
      await qr.release();
      await ds.destroy();
    }
  });
});
