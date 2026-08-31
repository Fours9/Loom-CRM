import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Variant 2 Access: Position manager template + EA managed departments.
 * Fail-closed migration from legacy employee_managed_departments / User.role.
 */
export class PositionEaManagedDepartments1730000035000
  implements MigrationInterface
{
  name = 'PositionEaManagedDepartments1730000035000';

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
        'Cannot add EA managed departments: duplicate active employment assignments exist.',
      );
    }

    await queryRunner.query(`
      ALTER TABLE "positions"
        ADD COLUMN "is_department_manager_template" boolean NOT NULL DEFAULT false
    `);

    await queryRunner.query(`
      ALTER TABLE "employment_assignments"
        ADD COLUMN "is_department_manager" boolean NOT NULL DEFAULT false
    `);

    await queryRunner.query(`
      CREATE TABLE "position_managed_departments" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "position_id" uuid NOT NULL,
        "department_id" uuid NOT NULL,
        CONSTRAINT "PK_position_managed_departments_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_position_managed_departments_pos_dept" UNIQUE ("position_id", "department_id"),
        CONSTRAINT "FK_position_managed_departments_position"
          FOREIGN KEY ("position_id") REFERENCES "positions"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_position_managed_departments_department"
          FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_position_managed_departments_position_id"
        ON "position_managed_departments" ("position_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_position_managed_departments_department_id"
        ON "position_managed_departments" ("department_id")
    `);

    await queryRunner.query(`
      CREATE TABLE "employment_assignment_managed_departments" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "assignment_id" uuid NOT NULL,
        "department_id" uuid NOT NULL,
        CONSTRAINT "PK_ea_managed_departments_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_ea_managed_departments_asg_dept" UNIQUE ("assignment_id", "department_id"),
        CONSTRAINT "FK_ea_managed_departments_assignment"
          FOREIGN KEY ("assignment_id") REFERENCES "employment_assignments"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_ea_managed_departments_department"
          FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_ea_managed_departments_assignment_id"
        ON "employment_assignment_managed_departments" ("assignment_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_ea_managed_departments_department_id"
        ON "employment_assignment_managed_departments" ("department_id")
    `);

    // Ensure UNIQUE one-active exists (idempotent if already from 1730000027000)
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_employment_assignments_one_active_per_employee"
      ON "employment_assignments" ("employee_id")
      WHERE "status" = 'active'
    `);

    // Preflight: User.role != Employee.role → report (reconcile from User.role in backfill)
    const roleMismatch = await queryRunner.query(`
      SELECT e.id AS employee_id, e.role AS employee_role, u.role AS user_role
      FROM employees e
      INNER JOIN users u ON u.id = e.user_id
      WHERE e.role IS DISTINCT FROM u.role
    `);
    if (roleMismatch.length > 0) {
      // Soft log via notice — reconcile uses User.role as SoT below
      console.warn(
        `[migration ${this.name}] User.role != Employee.role for ${roleMismatch.length} employee(s); reconciling from User.role`,
      );
    }

    // Fail-closed: employee User.role + EMD rows or legacy manager flags
    const inconsistentEmployee = await queryRunner.query(`
      SELECT e.id AS employee_id
      FROM employees e
      INNER JOIN users u ON u.id = e.user_id
      WHERE u.role = 'employee'
        AND (
          e.is_department_manager = true
          OR u.is_department_manager = true
          OR EXISTS (
            SELECT 1 FROM employee_managed_departments emd
            WHERE emd.employee_id = e.id
          )
        )
    `);
    if (inconsistentEmployee.length > 0) {
      throw new Error(
        `Cannot migrate: ${inconsistentEmployee.length} employee(s) have User.role=employee but legacy manager flags/EMD rows. Resolve before migration.`,
      );
    }

    // Employees without User: Employee.role=employee + EMD/flags → fail
    const inconsistentNoUser = await queryRunner.query(`
      SELECT e.id AS employee_id
      FROM employees e
      WHERE e.user_id IS NULL
        AND e.role = 'employee'
        AND (
          e.is_department_manager = true
          OR EXISTS (
            SELECT 1 FROM employee_managed_departments emd
            WHERE emd.employee_id = e.id
          )
        )
    `);
    if (inconsistentNoUser.length > 0) {
      throw new Error(
        `Cannot migrate: ${inconsistentNoUser.length} employee(s) without User have role=employee but legacy manager flags/EMD. Resolve before migration.`,
      );
    }

    // Orphan EMD without active EA → fail
    const orphanEmd = await queryRunner.query(`
      SELECT DISTINCT emd.employee_id
      FROM employee_managed_departments emd
      WHERE NOT EXISTS (
        SELECT 1 FROM employment_assignments ea
        WHERE ea.employee_id = emd.employee_id AND ea.status = 'active'
      )
    `);
    if (orphanEmd.length > 0) {
      throw new Error(
        `Cannot migrate: ${orphanEmd.length} employee(s) have EMD rows without an active employment assignment.`,
      );
    }

    // Backfill EA.is_department_manager + join from User.role (permission SoT)
    // department_manager → manager=true + exact EMD
    await queryRunner.query(`
      UPDATE employment_assignments ea
      SET is_department_manager = true
      FROM employees e
      LEFT JOIN users u ON u.id = e.user_id
      WHERE ea.employee_id = e.id
        AND ea.status = 'active'
        AND COALESCE(u.role, e.role) = 'department_manager'
    `);

    // admin: latent manager state from EMD or legacy flags
    await queryRunner.query(`
      UPDATE employment_assignments ea
      SET is_department_manager = true
      FROM employees e
      LEFT JOIN users u ON u.id = e.user_id
      WHERE ea.employee_id = e.id
        AND ea.status = 'active'
        AND COALESCE(u.role, e.role) = 'admin'
        AND (
          e.is_department_manager = true
          OR COALESCE(u.is_department_manager, false) = true
          OR EXISTS (
            SELECT 1 FROM employee_managed_departments emd
            WHERE emd.employee_id = e.id
          )
        )
    `);

    // Copy exact EMD rows onto active EA for DM and admin-latent managers
    await queryRunner.query(`
      INSERT INTO employment_assignment_managed_departments (id, assignment_id, department_id)
      SELECT gen_random_uuid(), ea.id, emd.department_id
      FROM employment_assignments ea
      INNER JOIN employees e ON e.id = ea.employee_id
      INNER JOIN employee_managed_departments emd ON emd.employee_id = e.id
      WHERE ea.status = 'active'
        AND ea.is_department_manager = true
      ON CONFLICT ("assignment_id", "department_id") DO NOTHING
    `);

    // Reconcile Employee.role from User.role where mismatched
    await queryRunner.query(`
      UPDATE employees e
      SET role = u.role
      FROM users u
      WHERE e.user_id = u.id
        AND e.role IS DISTINCT FROM u.role
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE IF EXISTS "employment_assignment_managed_departments"`,
    );
    await queryRunner.query(
      `DROP TABLE IF EXISTS "position_managed_departments"`,
    );
    await queryRunner.query(`
      ALTER TABLE "employment_assignments"
        DROP COLUMN IF EXISTS "is_department_manager"
    `);
    await queryRunner.query(`
      ALTER TABLE "positions"
        DROP COLUMN IF EXISTS "is_department_manager_template"
    `);
  }
}
