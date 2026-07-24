import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Employee Profile Core: companies/directions catalogs, employee core fields,
 * contacts, emergency contacts, employment assignments + backfill from legacy columns.
 */
export class EmployeeProfileCore1730000007000 implements MigrationInterface {
  name = 'EmployeeProfileCore1730000007000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "companies" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" character varying(255) NOT NULL,
        "code" character varying(64),
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_companies" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_companies_name" UNIQUE ("name")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "directions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" character varying(255) NOT NULL,
        "code" character varying(64),
        "company_id" uuid,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_directions" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_directions_name" UNIQUE ("name")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "employees"
        ADD COLUMN IF NOT EXISTS "preferred_name" character varying(120),
        ADD COLUMN IF NOT EXISTS "birth_date" date,
        ADD COLUMN IF NOT EXISTS "city" character varying(120),
        ADD COLUMN IF NOT EXISTS "preferred_language" character varying(64),
        ADD COLUMN IF NOT EXISTS "employment_status" character varying(32) NOT NULL DEFAULT 'active',
        ADD COLUMN IF NOT EXISTS "current_assignment_id" uuid,
        ADD COLUMN IF NOT EXISTS "archived_at" TIMESTAMPTZ
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "employee_contacts" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "employee_id" uuid NOT NULL,
        "type" character varying(32) NOT NULL,
        "value" character varying(320) NOT NULL,
        "is_primary" boolean NOT NULL DEFAULT false,
        "visibility" character varying(32) NOT NULL DEFAULT 'work',
        "verified_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_employee_contacts" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_employee_contacts_employee" ON "employee_contacts" ("employee_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "employee_emergency_contacts" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "employee_id" uuid NOT NULL,
        "full_name" character varying(255) NOT NULL,
        "relationship" character varying(120),
        "primary_phone" character varying(64) NOT NULL,
        "secondary_phone" character varying(64),
        "priority" integer NOT NULL DEFAULT 1,
        "notes" text,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_employee_emergency_contacts" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_employee_emergency_employee" ON "employee_emergency_contacts" ("employee_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "employment_assignments" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "employee_id" uuid NOT NULL,
        "company_id" uuid,
        "direction_id" uuid,
        "department_id" uuid,
        "position_id" uuid,
        "functional_role" character varying(120),
        "manager_employee_id" uuid,
        "mentor_employee_id" uuid,
        "hr_responsible_employee_id" uuid,
        "work_location" character varying(255),
        "work_format" character varying(64),
        "employment_type" character varying(64),
        "contract_type" character varying(64),
        "start_date" date,
        "end_date" date,
        "probation_end_date" date,
        "status" character varying(32) NOT NULL DEFAULT 'active',
        "change_reason" text,
        "created_by_user_id" uuid,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_employment_assignments" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_employment_assignments_employee_status" ON "employment_assignments" ("employee_id", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_employment_assignments_department" ON "employment_assignments" ("department_id", "status")`,
    );

    // Backfill contacts from legacy columns
    await queryRunner.query(`
      INSERT INTO "employee_contacts" ("employee_id", "type", "value", "is_primary", "visibility")
      SELECT id, 'work_phone', phone_number, true, 'work'
      FROM employees WHERE phone_number IS NOT NULL AND phone_number <> ''
        AND NOT EXISTS (
          SELECT 1 FROM employee_contacts c
          WHERE c.employee_id = employees.id AND c.type = 'work_phone'
        )
    `);
    await queryRunner.query(`
      INSERT INTO "employee_contacts" ("employee_id", "type", "value", "is_primary", "visibility")
      SELECT id, 'work_telegram', telegram, true, 'work'
      FROM employees WHERE telegram IS NOT NULL AND telegram <> ''
        AND NOT EXISTS (
          SELECT 1 FROM employee_contacts c
          WHERE c.employee_id = employees.id AND c.type = 'work_telegram'
        )
    `);
    await queryRunner.query(`
      INSERT INTO "employee_contacts" ("employee_id", "type", "value", "is_primary", "visibility")
      SELECT id, 'work_email', work_email, true, 'work'
      FROM employees WHERE work_email IS NOT NULL AND work_email <> ''
        AND NOT EXISTS (
          SELECT 1 FROM employee_contacts c
          WHERE c.employee_id = employees.id AND c.type = 'work_email'
        )
    `);
    await queryRunner.query(`
      INSERT INTO "employee_contacts" ("employee_id", "type", "value", "is_primary", "visibility")
      SELECT id, 'personal_phone', personal_phone_number, true, 'personal'
      FROM employees WHERE personal_phone_number IS NOT NULL AND personal_phone_number <> ''
        AND NOT EXISTS (
          SELECT 1 FROM employee_contacts c
          WHERE c.employee_id = employees.id AND c.type = 'personal_phone'
        )
    `);
    await queryRunner.query(`
      INSERT INTO "employee_contacts" ("employee_id", "type", "value", "is_primary", "visibility")
      SELECT id, 'personal_telegram', personal_telegram, true, 'personal'
      FROM employees WHERE personal_telegram IS NOT NULL AND personal_telegram <> ''
        AND NOT EXISTS (
          SELECT 1 FROM employee_contacts c
          WHERE c.employee_id = employees.id AND c.type = 'personal_telegram'
        )
    `);
    await queryRunner.query(`
      INSERT INTO "employee_contacts" ("employee_id", "type", "value", "is_primary", "visibility")
      SELECT id, 'personal_email', personal_email, true, 'personal'
      FROM employees WHERE personal_email IS NOT NULL AND personal_email <> ''
        AND NOT EXISTS (
          SELECT 1 FROM employee_contacts c
          WHERE c.employee_id = employees.id AND c.type = 'personal_email'
        )
    `);

    // Backfill one active assignment per employee from department/position
    await queryRunner.query(`
      INSERT INTO "employment_assignments" (
        "employee_id", "department_id", "position_id", "status", "start_date"
      )
      SELECT e.id, e.department_id, e.position_id, 'active', CURRENT_DATE
      FROM employees e
      WHERE NOT EXISTS (
        SELECT 1 FROM employment_assignments a
        WHERE a.employee_id = e.id AND a.status = 'active'
      )
    `);

    await queryRunner.query(`
      UPDATE employees e
      SET current_assignment_id = a.id,
          employment_status = CASE WHEN e.is_active THEN 'active' ELSE 'archived' END,
          archived_at = CASE WHEN e.is_active THEN NULL ELSE now() END
      FROM employment_assignments a
      WHERE a.employee_id = e.id AND a.status = 'active'
        AND e.current_assignment_id IS NULL
    `);

    // Seed default directions from anketa meta (optional catalog)
    await queryRunner.query(`
      INSERT INTO "directions" ("name", "code")
      SELECT v.name, v.code FROM (VALUES
        ('Адмін', 'ADMIN'),
        ('OLIMI', 'OLIMI'),
        ('TIER', 'TIER'),
        ('Шв.', 'SHV'),
        ('LIKE', 'LIKE'),
        ('РАЗОМ', 'RAZOM'),
        ('СТК', 'STK'),
        ('Меб.', 'MEB')
      ) AS v(name, code)
      WHERE NOT EXISTS (SELECT 1 FROM directions d WHERE d.name = v.name)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "employment_assignments"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "employee_emergency_contacts"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "employee_contacts"`);
    await queryRunner.query(`
      ALTER TABLE "employees"
        DROP COLUMN IF EXISTS "preferred_name",
        DROP COLUMN IF EXISTS "birth_date",
        DROP COLUMN IF EXISTS "city",
        DROP COLUMN IF EXISTS "preferred_language",
        DROP COLUMN IF EXISTS "employment_status",
        DROP COLUMN IF EXISTS "current_assignment_id",
        DROP COLUMN IF EXISTS "archived_at"
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS "directions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "companies"`);
  }
}
