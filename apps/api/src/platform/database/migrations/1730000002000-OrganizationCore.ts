import { MigrationInterface, QueryRunner } from 'typeorm';

export class OrganizationCore1730000002000 implements MigrationInterface {
  name = 'OrganizationCore1730000002000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "departments" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" character varying(255) NOT NULL,
        "description" text,
        "is_hidden" boolean NOT NULL DEFAULT false,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_departments" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "positions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" character varying(255) NOT NULL,
        "department_id" uuid,
        "description" text,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_positions" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_positions_department" ON "positions" ("department_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "employees" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid,
        "role" character varying(64) NOT NULL DEFAULT 'employee',
        "is_department_manager" boolean NOT NULL DEFAULT false,
        "employee_number" character varying(64) NOT NULL,
        "first_name" character varying(120) NOT NULL,
        "last_name" character varying(120) NOT NULL,
        "middle_name" character varying(120),
        "work_email" character varying(320),
        "department_id" uuid,
        "position_id" uuid,
        "calendar_color" character varying(32),
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_employees" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_employees_number" UNIQUE ("employee_number"),
        CONSTRAINT "UQ_employees_user" UNIQUE ("user_id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_employees_department" ON "employees" ("department_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_employees_position" ON "employees" ("position_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "work_schedule_days" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "employee_id" uuid NOT NULL,
        "weekday" smallint NOT NULL,
        "start_time" character varying(8),
        "end_time" character varying(8),
        "is_day_off" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_work_schedule_days" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_work_schedule_employee_weekday" UNIQUE ("employee_id", "weekday")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_work_schedule_employee" ON "work_schedule_days" ("employee_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "employee_managed_departments" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "employee_id" uuid NOT NULL,
        "department_id" uuid NOT NULL,
        CONSTRAINT "PK_employee_managed_departments" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_employee_managed_dept" UNIQUE ("employee_id", "department_id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_emd_employee" ON "employee_managed_departments" ("employee_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_emd_department" ON "employee_managed_departments" ("department_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "employee_managed_departments"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "work_schedule_days"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "employees"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "positions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "departments"`);
  }
}
