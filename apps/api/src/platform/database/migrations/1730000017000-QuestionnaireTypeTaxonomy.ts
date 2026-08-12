import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Questionnaire template type taxonomy:
 * primary | general | managing | docs
 * Fail-closed: no silent hr/full → docs remaps; down() cannot restore.
 */
export class QuestionnaireTypeTaxonomy1730000017000
  implements MigrationInterface
{
  name = 'QuestionnaireTypeTaxonomy1730000017000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "questionnaire_templates"
      DROP CONSTRAINT IF EXISTS "CHK_questionnaire_templates_type"
    `);

    await queryRunner.query(`
      UPDATE "questionnaire_templates"
      SET "type" = 'primary'
      WHERE "code" = 'employee-360' AND "type" = 'general'
    `);

    await queryRunner.query(`
      UPDATE "questionnaire_templates"
      SET "type" = 'managing'
      WHERE "type" = 'manager'
    `);

    const legacy: Array<{ count: string }> = await queryRunner.query(`
      SELECT COUNT(*)::text AS count
      FROM "questionnaire_templates"
      WHERE "type" NOT IN ('primary', 'general', 'managing', 'docs')
    `);
    if (Number(legacy[0]?.count ?? 0) > 0) {
      throw new Error(
        'QuestionnaireTypeTaxonomy: unexpected legacy template types (hr/manager/full/…). Remap by template code explicitly; refusing silent docs remap.',
      );
    }

    await queryRunner.query(`
      ALTER TABLE "questionnaire_templates"
      ADD CONSTRAINT "CHK_questionnaire_templates_type" CHECK (
        "type" IN ('primary', 'general', 'managing', 'docs')
      )
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    throw new Error(
      'Cannot rollback questionnaire type taxonomy: primary/docs/managing have no unambiguous reverse mapping',
    );
  }
}
