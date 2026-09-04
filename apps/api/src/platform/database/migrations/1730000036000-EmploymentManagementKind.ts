import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ADR 0011 step 1: org leadership becomes a kind (none | departments | direction).
 * Legacy booleans stay as display mirrors — no DROP in this increment.
 */
export class EmploymentManagementKind1730000036000
  implements MigrationInterface
{
  name = 'EmploymentManagementKind1730000036000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "positions"
        ADD COLUMN "management_kind_template" varchar(32) NOT NULL DEFAULT 'none'
    `);
    await queryRunner.query(`
      ALTER TABLE "employment_assignments"
        ADD COLUMN "management_kind" varchar(32) NOT NULL DEFAULT 'none'
    `);

    await queryRunner.query(`
      UPDATE "positions"
      SET "management_kind_template" = 'departments'
      WHERE "is_department_manager_template" = true
    `);
    await queryRunner.query(`
      UPDATE "employment_assignments"
      SET "management_kind" = 'departments'
      WHERE "is_department_manager" = true
    `);

    await queryRunner.query(`
      ALTER TABLE "positions"
        ADD CONSTRAINT "CHK_positions_management_kind_template"
        CHECK ("management_kind_template" IN ('none', 'departments', 'direction'))
    `);
    await queryRunner.query(`
      ALTER TABLE "employment_assignments"
        ADD CONSTRAINT "CHK_employment_assignments_management_kind"
        CHECK ("management_kind" IN ('none', 'departments', 'direction'))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "employment_assignments"
        DROP CONSTRAINT IF EXISTS "CHK_employment_assignments_management_kind"
    `);
    await queryRunner.query(`
      ALTER TABLE "positions"
        DROP CONSTRAINT IF EXISTS "CHK_positions_management_kind_template"
    `);
    await queryRunner.query(`
      ALTER TABLE "employment_assignments"
        DROP COLUMN IF EXISTS "management_kind"
    `);
    await queryRunner.query(`
      ALTER TABLE "positions"
        DROP COLUMN IF EXISTS "management_kind_template"
    `);
  }
}
