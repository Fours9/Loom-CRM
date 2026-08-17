import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Native skill scale (range / percent) independent of questionnaire 0–5.
 * Drops invalid universal default 0 on position_skill_requirements.target_level.
 */
export class SkillNativeScale1730000025000 implements MigrationInterface {
  name = 'SkillNativeScale1730000025000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "skills"
        ADD COLUMN IF NOT EXISTS "scale_kind" character varying(16) NOT NULL DEFAULT 'range',
        ADD COLUMN IF NOT EXISTS "scale_min" integer NOT NULL DEFAULT 0
    `);
    await queryRunner.query(`
      UPDATE "skills"
      SET "scale_kind" = 'range', "scale_min" = 0
      WHERE "scale_kind" IS NULL OR "scale_min" IS NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "skills"
        DROP CONSTRAINT IF EXISTS "CHK_skills_scale_kind",
        DROP CONSTRAINT IF EXISTS "CHK_skills_scale_bounds",
        DROP CONSTRAINT IF EXISTS "CHK_skills_percent_bounds"
    `);
    await queryRunner.query(`
      ALTER TABLE "skills"
        ADD CONSTRAINT "CHK_skills_scale_kind"
          CHECK ("scale_kind" IN ('range', 'percent')),
        ADD CONSTRAINT "CHK_skills_scale_bounds"
          CHECK ("scale_min" < "scale_max"),
        ADD CONSTRAINT "CHK_skills_percent_bounds"
          CHECK (
            "scale_kind" <> 'percent'
            OR ("scale_min" >= 0 AND "scale_max" <= 100)
          )
    `);
    await queryRunner.query(`
      ALTER TABLE "position_skill_requirements"
        ALTER COLUMN "target_level" DROP DEFAULT
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "position_skill_requirements"
        ALTER COLUMN "target_level" SET DEFAULT 0
    `);
    await queryRunner.query(`
      ALTER TABLE "skills"
        DROP CONSTRAINT IF EXISTS "CHK_skills_scale_kind",
        DROP CONSTRAINT IF EXISTS "CHK_skills_scale_bounds",
        DROP CONSTRAINT IF EXISTS "CHK_skills_percent_bounds"
    `);
    await queryRunner.query(`
      ALTER TABLE "skills"
        DROP COLUMN IF EXISTS "scale_kind",
        DROP COLUMN IF EXISTS "scale_min"
    `);
  }
}
