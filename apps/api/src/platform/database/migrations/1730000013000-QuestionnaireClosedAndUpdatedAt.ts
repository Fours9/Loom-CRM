import { MigrationInterface, QueryRunner } from 'typeorm';

export class QuestionnaireClosedAndUpdatedAt1730000013000
  implements MigrationInterface
{
  name = 'QuestionnaireClosedAndUpdatedAt1730000013000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "questionnaire_assignments"
      ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
    `);

    await queryRunner.query(`
      ALTER TABLE "questionnaire_assignments"
      DROP CONSTRAINT IF EXISTS "CHK_questionnaire_assignments_status"
    `);
    await queryRunner.query(`
      ALTER TABLE "questionnaire_assignments"
      ADD CONSTRAINT "CHK_questionnaire_assignments_status" CHECK (
        "status" IN (
          'assigned',
          'in_progress',
          'submitted',
          'changes_requested',
          'reviewed',
          'cancelled',
          'closed'
        )
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const rows = await queryRunner.query(`
      SELECT 1 FROM "questionnaire_assignments" WHERE "status" = 'closed' LIMIT 1
    `);
    if (rows.length) {
      throw new Error(
        'Cannot rollback: closed questionnaire assignments exist',
      );
    }

    await queryRunner.query(`
      ALTER TABLE "questionnaire_assignments"
      DROP CONSTRAINT IF EXISTS "CHK_questionnaire_assignments_status"
    `);
    await queryRunner.query(`
      ALTER TABLE "questionnaire_assignments"
      ADD CONSTRAINT "CHK_questionnaire_assignments_status" CHECK (
        "status" IN (
          'assigned',
          'in_progress',
          'submitted',
          'changes_requested',
          'reviewed',
          'cancelled'
        )
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "questionnaire_assignments"
      DROP COLUMN IF EXISTS "updated_at"
    `);
  }
}
