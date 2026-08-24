import { MigrationInterface, QueryRunner } from 'typeorm';

export class EmploymentCatalogsAndAssignmentFields1730000027000
  implements MigrationInterface
{
  name = 'EmploymentCatalogsAndAssignmentFields1730000027000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const duplicateActive = await queryRunner.query(`
      SELECT "employee_id"
      FROM "employment_assignments"
      WHERE "status" = 'active'
      GROUP BY "employee_id"
      HAVING COUNT(*) > 1
    `);
    if (duplicateActive.length > 0) {
      throw new Error(
        'Cannot add one-active-per-employee invariant: duplicate active employment assignments exist.',
      );
    }

    const duplicatePlanned = await queryRunner.query(`
      SELECT "employee_id"
      FROM "employment_assignments"
      WHERE "status" = 'planned'
      GROUP BY "employee_id"
      HAVING COUNT(*) > 1
    `);
    if (duplicatePlanned.length > 0) {
      throw new Error(
        'Cannot add one-planned-per-employee invariant: duplicate planned employment assignments exist.',
      );
    }

    await queryRunner.query(`
      ALTER TABLE "departments"
        ADD COLUMN "location" varchar(255)
    `);
    await queryRunner.query(`
      ALTER TABLE "employees"
        ADD COLUMN "hired_at" date
    `);
    await queryRunner.query(`
      ALTER TABLE "employment_assignments"
        ADD COLUMN "probation_start_date" date,
        ADD COLUMN "activation_blocked_reason" varchar(64),
        ADD COLUMN "activation_checked_at" timestamptz
    `);
    await queryRunner.query(`
      CREATE TABLE "work_formats" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" varchar(64) NOT NULL,
        "sort_order" integer NOT NULL DEFAULT 0,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_work_formats_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_work_formats_name" UNIQUE ("name")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "employment_types" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" varchar(64) NOT NULL,
        "sort_order" integer NOT NULL DEFAULT 0,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_employment_types_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_employment_types_name" UNIQUE ("name")
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_employment_assignments_one_active_per_employee"
      ON "employment_assignments" ("employee_id")
      WHERE "status" = 'active'
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_employment_assignments_one_planned_per_employee"
      ON "employment_assignments" ("employee_id")
      WHERE "status" = 'planned'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX "UQ_employment_assignments_one_planned_per_employee"
    `);
    await queryRunner.query(`
      DROP INDEX "UQ_employment_assignments_one_active_per_employee"
    `);
    await queryRunner.query(`
      DROP TABLE "employment_types"
    `);
    await queryRunner.query(`
      DROP TABLE "work_formats"
    `);
    await queryRunner.query(`
      ALTER TABLE "employment_assignments"
        DROP COLUMN "activation_checked_at",
        DROP COLUMN "activation_blocked_reason",
        DROP COLUMN "probation_start_date"
    `);
    await queryRunner.query(`
      ALTER TABLE "employees"
        DROP COLUMN "hired_at"
    `);
    await queryRunner.query(`
      ALTER TABLE "departments"
        DROP COLUMN "location"
    `);
  }
}
