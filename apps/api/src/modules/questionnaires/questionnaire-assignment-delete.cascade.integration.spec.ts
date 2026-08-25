import { DataSource } from 'typeorm';
import { requireIsolatedTestDatabaseUrl } from '../../platform/database/require-isolated-test-database-url';

/**
 * Live CASCADE wipe for questionnaire aggregates.
 * Requires migrated TEST_DATABASE_URL (loom_crm_test); creates its own fixtures.
 */
describe('Questionnaire assignment hard-delete (integration)', () => {
  it('wipes questionnaire aggregate and does not rollback applied profile city', async () => {
    const url = requireIsolatedTestDatabaseUrl();
    const ds = new DataSource({
      type: 'postgres',
      url,
      synchronize: false,
    });
    await ds.initialize();
    const qr = ds.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    const stamp = Date.now();
    try {
      const [user] = await qr.query(
        `INSERT INTO users (email, password_hash, role, status)
         VALUES ($1, 'x', 'admin', 'active')
         RETURNING id`,
        [`cascade-del-${stamp}@example.test`],
      );
      const actorId = user.id as string;

      const markerCity = `cascade-test-${stamp}`;
      const [emp] = await qr.query(
        `INSERT INTO employees
          (employee_number, first_name, last_name, role, city)
         VALUES ($1, 'Cascade', 'Delete', 'employee', $2)
         RETURNING id, city`,
        [`CASCADE-${stamp}`, markerCity],
      );
      const employeeId = emp.id as string;
      expect(emp.city).toBe(markerCity);

      const [tmpl] = await qr.query(
        `INSERT INTO questionnaire_templates (code, title, status, type)
         VALUES ($1, 'Cascade fixture', 'published', 'full')
         RETURNING id`,
        [`cascade-del-${stamp}`],
      );
      const [version] = await qr.query(
        `INSERT INTO questionnaire_template_versions
          (template_id, version, schema_json, published_at)
         VALUES ($1, 1, '{}'::jsonb, NOW())
         RETURNING id`,
        [tmpl.id],
      );
      const versionId = version.id as string;

      const [assignment] = await qr.query(
        `INSERT INTO questionnaire_assignments
          (template_version_id, employee_id, assigned_by_user_id, status, code)
         VALUES ($1, $2, $3, 'assigned', $4)
         RETURNING id`,
        [versionId, employeeId, actorId, `CST-${stamp}`],
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
    } finally {
      await qr.rollbackTransaction();
      await qr.release();
      await ds.destroy();
    }
  });
});
