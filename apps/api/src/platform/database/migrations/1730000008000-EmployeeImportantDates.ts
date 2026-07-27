import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Employee Profile Core: repeating important dates (title + start/end).
 */
export class EmployeeImportantDates1730000008000 implements MigrationInterface {
  name = 'EmployeeImportantDates1730000008000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "employee_important_dates" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "employee_id" uuid NOT NULL,
        "title" character varying(255) NOT NULL,
        "start_date" date NOT NULL,
        "end_date" date,
        "priority" integer NOT NULL DEFAULT 1,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_employee_important_dates" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_employee_important_dates_employee" ON "employee_important_dates" ("employee_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_employee_important_dates_employee"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "employee_important_dates"`);
  }
}
