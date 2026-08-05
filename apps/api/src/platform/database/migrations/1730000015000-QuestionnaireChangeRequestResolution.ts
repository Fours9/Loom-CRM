import { MigrationInterface, QueryRunner } from 'typeorm';

export class QuestionnaireChangeRequestResolution1730000015000
  implements MigrationInterface
{
  name = 'QuestionnaireChangeRequestResolution1730000015000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "questionnaire_submissions"
      ADD COLUMN IF NOT EXISTS "change_request_resolution" varchar(32) NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "questionnaire_submissions"
      ADD COLUMN IF NOT EXISTS "change_request_resolved_by_user_id" uuid NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "questionnaire_submissions"
      ADD COLUMN IF NOT EXISTS "change_request_resolved_at" TIMESTAMPTZ NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "questionnaire_submissions"
      DROP CONSTRAINT IF EXISTS "CHK_questionnaire_submissions_change_request_resolution"
    `);
    await queryRunner.query(`
      ALTER TABLE "questionnaire_submissions"
      ADD CONSTRAINT "CHK_questionnaire_submissions_change_request_resolution" CHECK (
        "change_request_resolution" IS NULL
        OR "change_request_resolution" IN ('completed', 'declined')
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "questionnaire_submissions"
      DROP CONSTRAINT IF EXISTS "CHK_questionnaire_submissions_change_request_resolution"
    `);
    await queryRunner.query(`
      ALTER TABLE "questionnaire_submissions"
      DROP COLUMN IF EXISTS "change_request_resolved_at"
    `);
    await queryRunner.query(`
      ALTER TABLE "questionnaire_submissions"
      DROP COLUMN IF EXISTS "change_request_resolved_by_user_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "questionnaire_submissions"
      DROP COLUMN IF EXISTS "change_request_resolution"
    `);
  }
}
