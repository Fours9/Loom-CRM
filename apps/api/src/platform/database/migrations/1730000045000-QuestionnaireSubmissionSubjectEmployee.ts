import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Immutable subject employee on questionnaire submissions (cross-employee reattach).
 * Backfill from current assignment.employee_id, else detached_from_employee_id.
 */
export class QuestionnaireSubmissionSubjectEmployee1730000045000
  implements MigrationInterface
{
  name = 'QuestionnaireSubmissionSubjectEmployee1730000045000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "questionnaire_submissions"
        ADD COLUMN IF NOT EXISTS "subject_employee_id" uuid
    `);

    await queryRunner.query(`
      UPDATE "questionnaire_submissions" qs
      SET "subject_employee_id" = COALESCE(qa.employee_id, qa.detached_from_employee_id)
      FROM "questionnaire_responses" qr
      INNER JOIN "questionnaire_assignments" qa ON qa.id = qr.assignment_id
      WHERE qs.response_id = qr.id
        AND qs.subject_employee_id IS NULL
    `);

    // Orphan / unresolvable rows: keep NOT NULL by using a sentinel only if needed.
    // Prefer fail-closed: delete impossible rows without employee provenance (should be none).
    await queryRunner.query(`
      DELETE FROM "questionnaire_submissions"
      WHERE "subject_employee_id" IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "questionnaire_submissions"
        ALTER COLUMN "subject_employee_id" SET NOT NULL
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "questionnaire_submissions"
          ADD CONSTRAINT "FK_questionnaire_submissions_subject_employee"
          FOREIGN KEY ("subject_employee_id") REFERENCES "employees"("id")
          ON DELETE RESTRICT;
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_questionnaire_submissions_subject_employee"
        ON "questionnaire_submissions" ("subject_employee_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "questionnaire_submissions"
        DROP CONSTRAINT IF EXISTS "FK_questionnaire_submissions_subject_employee"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_questionnaire_submissions_subject_employee"
    `);
    await queryRunner.query(`
      ALTER TABLE "questionnaire_submissions"
        DROP COLUMN IF EXISTS "subject_employee_id"
    `);
  }
}
