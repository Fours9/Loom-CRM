import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Position Catalog PR6: frozen QuestionnaireContextV1 on assignments + submissions.
 */
export class QuestionnaireContextJson1730000021000 implements MigrationInterface {
  name = 'QuestionnaireContextJson1730000021000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "questionnaire_assignments"
      ADD COLUMN IF NOT EXISTS "context_json" jsonb
    `);
    await queryRunner.query(`
      ALTER TABLE "questionnaire_submissions"
      ADD COLUMN IF NOT EXISTS "context_json" jsonb
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "questionnaire_submissions"
      DROP COLUMN IF EXISTS "context_json"
    `);
    await queryRunner.query(`
      ALTER TABLE "questionnaire_assignments"
      DROP COLUMN IF EXISTS "context_json"
    `);
  }
}
