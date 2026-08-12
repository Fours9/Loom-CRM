import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Collapse primary + general → full («Повна»).
 * Removes obsolete employee-general stub when unused.
 * Fail-closed down().
 */
export class QuestionnaireTypeFullCollapse1730000018000
  implements MigrationInterface
{
  name = 'QuestionnaireTypeFullCollapse1730000018000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "questionnaire_templates"
      DROP CONSTRAINT IF EXISTS "CHK_questionnaire_templates_type"
    `);

    await queryRunner.query(`
      UPDATE "questionnaire_templates"
      SET "type" = 'full'
      WHERE "type" IN ('primary', 'general')
    `);

    // Drop unused general stub (Variant A leftover).
    const stubUsage: Array<{ count: string }> = await queryRunner.query(`
      SELECT COUNT(*)::text AS count
      FROM "questionnaire_assignments" a
      INNER JOIN "questionnaire_template_versions" v
        ON v.id = a.template_version_id
      INNER JOIN "questionnaire_templates" t
        ON t.id = v.template_id
      WHERE t.code = 'employee-general'
    `);
    if (Number(stubUsage[0]?.count ?? 0) === 0) {
      await queryRunner.query(`
        DELETE FROM "questionnaire_template_versions" v
        USING "questionnaire_templates" t
        WHERE v.template_id = t.id AND t.code = 'employee-general'
      `);
      await queryRunner.query(`
        DELETE FROM "questionnaire_templates"
        WHERE "code" = 'employee-general'
      `);
    } else {
      await queryRunner.query(`
        UPDATE "questionnaire_templates"
        SET "status" = 'archived', "type" = 'full', "title" = 'Повна'
        WHERE "code" = 'employee-general'
      `);
    }

    await queryRunner.query(`
      UPDATE "questionnaire_templates"
      SET "title" = 'Повна анкета', "type" = 'full'
      WHERE "code" = 'employee-360'
    `);

    const legacy: Array<{ count: string }> = await queryRunner.query(`
      SELECT COUNT(*)::text AS count
      FROM "questionnaire_templates"
      WHERE "type" NOT IN ('full', 'managing', 'docs')
    `);
    if (Number(legacy[0]?.count ?? 0) > 0) {
      throw new Error(
        'QuestionnaireTypeFullCollapse: unexpected template types after primary/general→full remap',
      );
    }

    await queryRunner.query(`
      ALTER TABLE "questionnaire_templates"
      ALTER COLUMN "type" SET DEFAULT 'full'
    `);

    await queryRunner.query(`
      ALTER TABLE "questionnaire_templates"
      ADD CONSTRAINT "CHK_questionnaire_templates_type" CHECK (
        "type" IN ('full', 'managing', 'docs')
      )
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    throw new Error(
      'Cannot rollback questionnaire full collapse: primary/general merge is irreversible',
    );
  }
}
