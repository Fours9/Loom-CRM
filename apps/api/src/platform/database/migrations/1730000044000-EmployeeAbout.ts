import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Profile Core «Про себе» SoT.
 * employee_id ON DELETE RESTRICT — erase via OrganizationEmployeeErasureFacade.
 * last_source_submission_id has NO FK to questionnaire_submissions.
 */
export class EmployeeAbout1730000044000 implements MigrationInterface {
  name = 'EmployeeAbout1730000044000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "employee_about" (
        "employee_id" uuid NOT NULL,
        "answers" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "updated_at" TIMESTAMPTZ NOT NULL,
        "updated_by_user_id" uuid,
        "last_source_submission_id" uuid,
        "last_synced_at" TIMESTAMPTZ,
        CONSTRAINT "PK_employee_about" PRIMARY KEY ("employee_id"),
        CONSTRAINT "FK_employee_about_employee"
          FOREIGN KEY ("employee_id") REFERENCES "employees"("id")
          ON DELETE RESTRICT
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "employee_about"`);
  }
}
