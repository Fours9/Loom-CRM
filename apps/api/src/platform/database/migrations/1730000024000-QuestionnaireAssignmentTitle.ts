import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Optional per-assignment display title (overrides template.title in UI).
 */
export class QuestionnaireAssignmentTitle1730000024000
  implements MigrationInterface
{
  name = 'QuestionnaireAssignmentTitle1730000024000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "questionnaire_assignments"
      ADD COLUMN IF NOT EXISTS "title" character varying(255)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "questionnaire_assignments"
      DROP COLUMN IF EXISTS "title"
    `);
  }
}
