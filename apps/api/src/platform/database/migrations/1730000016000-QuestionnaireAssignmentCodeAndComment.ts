import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Per-assignment human codes + service HR comment + monotonic prefix counters.
 * Prefix mapping (must match runtime questionnaireAssignmentCodePrefix):
 *   employee-360 → 360; type general → ZAG; hr → HR; manager → MAN; full → POV
 */
export class QuestionnaireAssignmentCodeAndComment1730000016000
  implements MigrationInterface
{
  name = 'QuestionnaireAssignmentCodeAndComment1730000016000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "questionnaire_assignments"
      ADD COLUMN IF NOT EXISTS "code" varchar(32) NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "questionnaire_assignments"
      ADD COLUMN IF NOT EXISTS "comment" text NULL
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "questionnaire_assignment_code_counters" (
        "prefix" varchar(16) PRIMARY KEY,
        "next_value" integer NOT NULL
      )
    `);

    await queryRunner.query(`
      WITH ranked AS (
        SELECT
          a.id,
          CASE
            WHEN tmpl.code = 'employee-360' THEN '360'
            WHEN tmpl.type = 'general' THEN 'ZAG'
            WHEN tmpl.type = 'hr' THEN 'HR'
            WHEN tmpl.type = 'manager' THEN 'MAN'
            WHEN tmpl.type = 'full' THEN 'POV'
            ELSE NULL
          END AS prefix,
          ROW_NUMBER() OVER (
            PARTITION BY
              CASE
                WHEN tmpl.code = 'employee-360' THEN '360'
                WHEN tmpl.type = 'general' THEN 'ZAG'
                WHEN tmpl.type = 'hr' THEN 'HR'
                WHEN tmpl.type = 'manager' THEN 'MAN'
                WHEN tmpl.type = 'full' THEN 'POV'
                ELSE NULL
              END
            ORDER BY a.created_at ASC, a.id ASC
          ) AS rn
        FROM "questionnaire_assignments" a
        INNER JOIN "questionnaire_template_versions" tv
          ON tv.id = a.template_version_id
        INNER JOIN "questionnaire_templates" tmpl
          ON tmpl.id = tv.template_id
        WHERE a.code IS NULL
      )
      UPDATE "questionnaire_assignments" a
      SET "code" = ranked.prefix || '-' || LPAD(ranked.rn::text, 3, '0')
      FROM ranked
      WHERE a.id = ranked.id
        AND ranked.prefix IS NOT NULL
    `);

    const nullCodes: Array<{ count: string }> = await queryRunner.query(`
      SELECT COUNT(*)::text AS count
      FROM "questionnaire_assignments"
      WHERE "code" IS NULL
    `);
    if (Number(nullCodes[0]?.count ?? 0) > 0) {
      throw new Error(
        'QuestionnaireAssignmentCodeAndComment: backfill left NULL codes (unknown template prefix)',
      );
    }

    const dupes: Array<{ count: string }> = await queryRunner.query(`
      SELECT COUNT(*)::text AS count FROM (
        SELECT "code" FROM "questionnaire_assignments"
        GROUP BY "code" HAVING COUNT(*) > 1
      ) d
    `);
    if (Number(dupes[0]?.count ?? 0) > 0) {
      throw new Error(
        'QuestionnaireAssignmentCodeAndComment: duplicate codes after backfill',
      );
    }

    await queryRunner.query(`
      INSERT INTO "questionnaire_assignment_code_counters" ("prefix", "next_value")
      SELECT
        split_part(a.code, '-', 1) AS prefix,
        (MAX(
          CASE
            WHEN split_part(a.code, '-', 2) ~ '^[0-9]+$'
            THEN split_part(a.code, '-', 2)::integer
            ELSE 0
          END
        ) + 1) AS next_value
      FROM "questionnaire_assignments" a
      WHERE a.code IS NOT NULL AND position('-' in a.code) > 0
      GROUP BY split_part(a.code, '-', 1)
      ON CONFLICT ("prefix") DO UPDATE
      SET "next_value" = GREATEST(
        "questionnaire_assignment_code_counters"."next_value",
        EXCLUDED."next_value"
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "questionnaire_assignments"
      ALTER COLUMN "code" SET NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "questionnaire_assignments"
      DROP CONSTRAINT IF EXISTS "UQ_questionnaire_assignments_code"
    `);
    await queryRunner.query(`
      ALTER TABLE "questionnaire_assignments"
      ADD CONSTRAINT "UQ_questionnaire_assignments_code" UNIQUE ("code")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "questionnaire_assignments"
      DROP CONSTRAINT IF EXISTS "UQ_questionnaire_assignments_code"
    `);
    await queryRunner.query(`
      ALTER TABLE "questionnaire_assignments"
      DROP COLUMN IF EXISTS "comment"
    `);
    await queryRunner.query(`
      ALTER TABLE "questionnaire_assignments"
      DROP COLUMN IF EXISTS "code"
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS "questionnaire_assignment_code_counters"
    `);
  }
}
