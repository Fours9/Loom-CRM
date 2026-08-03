import { MigrationInterface, QueryRunner } from 'typeorm';

export class QuestionnaireUnattachedAndTypes1730000014000
  implements MigrationInterface
{
  name = 'QuestionnaireUnattachedAndTypes1730000014000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "questionnaire_templates"
      ADD COLUMN IF NOT EXISTS "type" varchar(32) NOT NULL DEFAULT 'general'
    `);
    await queryRunner.query(`
      ALTER TABLE "questionnaire_templates"
      DROP CONSTRAINT IF EXISTS "CHK_questionnaire_templates_type"
    `);
    await queryRunner.query(`
      ALTER TABLE "questionnaire_templates"
      ADD CONSTRAINT "CHK_questionnaire_templates_type" CHECK (
        "type" IN ('general', 'hr', 'manager', 'full')
      )
    `);
    await queryRunner.query(`
      UPDATE "questionnaire_templates" SET "type" = 'general' WHERE "type" IS NULL OR "type" = ''
    `);

    await queryRunner.query(`
      ALTER TABLE "questionnaire_assignments"
      ALTER COLUMN "employee_id" DROP NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "questionnaire_assignments"
      ADD COLUMN IF NOT EXISTS "detached_from_employee_id" uuid NULL
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "questionnaire_assignments"
        ADD CONSTRAINT "FK_questionnaire_assignments_detached_from_employee"
        FOREIGN KEY ("detached_from_employee_id")
        REFERENCES "employees"("id")
        ON DELETE CASCADE;
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_questionnaire_assignments_detached_from_employee"
      ON "questionnaire_assignments" ("detached_from_employee_id")
    `);

    await queryRunner.query(`
      ALTER TABLE "questionnaire_assignments"
      DROP CONSTRAINT IF EXISTS "CHK_questionnaire_assignments_status"
    `);
    await queryRunner.query(`
      ALTER TABLE "questionnaire_assignments"
      ADD CONSTRAINT "CHK_questionnaire_assignments_status" CHECK (
        "status" IN (
          'new',
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

    await queryRunner.query(`
      ALTER TABLE "questionnaire_assignments"
      DROP CONSTRAINT IF EXISTS "CHK_questionnaire_assignments_employee_state"
    `);
    await queryRunner.query(`
      ALTER TABLE "questionnaire_assignments"
      ADD CONSTRAINT "CHK_questionnaire_assignments_employee_state" CHECK (
        (
          "status" = 'new'
          AND "employee_id" IS NULL
          AND "detached_from_employee_id" IS NULL
        )
        OR
        (
          "status" IN (
            'assigned',
            'in_progress',
            'submitted',
            'changes_requested',
            'reviewed'
          )
          AND "employee_id" IS NOT NULL
          AND "detached_from_employee_id" IS NULL
        )
        OR
        (
          "status" = 'cancelled'
          AND (
            (
              "employee_id" IS NULL
              AND "detached_from_employee_id" IS NOT NULL
            )
            OR
            (
              "employee_id" IS NOT NULL
              AND "detached_from_employee_id" IS NULL
            )
          )
        )
        OR
        (
          "status" = 'closed'
          AND (
            (
              "employee_id" IS NOT NULL
              AND "detached_from_employee_id" IS NULL
            )
            OR
            (
              "employee_id" IS NULL
              AND "detached_from_employee_id" IS NOT NULL
            )
          )
        )
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const rows = await queryRunner.query(`
      SELECT 1 FROM "questionnaire_assignments"
      WHERE "employee_id" IS NULL OR "status" = 'new'
      LIMIT 1
    `);
    if (rows.length) {
      throw new Error(
        'Cannot rollback: unattached questionnaire assignments exist',
      );
    }

    await queryRunner.query(`
      ALTER TABLE "questionnaire_assignments"
      DROP CONSTRAINT IF EXISTS "CHK_questionnaire_assignments_employee_state"
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

    await queryRunner.query(`
      ALTER TABLE "questionnaire_assignments"
      DROP CONSTRAINT IF EXISTS "FK_questionnaire_assignments_detached_from_employee"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_questionnaire_assignments_detached_from_employee"
    `);
    await queryRunner.query(`
      ALTER TABLE "questionnaire_assignments"
      DROP COLUMN IF EXISTS "detached_from_employee_id"
    `);

    await queryRunner.query(`
      ALTER TABLE "questionnaire_assignments"
      ALTER COLUMN "employee_id" SET NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "questionnaire_templates"
      DROP CONSTRAINT IF EXISTS "CHK_questionnaire_templates_type"
    `);
    await queryRunner.query(`
      ALTER TABLE "questionnaire_templates"
      DROP COLUMN IF EXISTS "type"
    `);
  }
}
