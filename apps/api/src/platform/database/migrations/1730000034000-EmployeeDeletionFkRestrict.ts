import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Hard-delete integrity: employee-owned module rows must not CASCADE away
 * silently. Facades erase explicitly; final DELETE employees fails closed via
 * ON DELETE RESTRICT. Orphan preflight fails the migration (no silent cleanup).
 *
 * Also introduces file_deletion_outbox for post-COMMIT external storage cleanup.
 */
export class EmployeeDeletionFkRestrict1730000034000
  implements MigrationInterface
{
  name = 'EmployeeDeletionFkRestrict1730000034000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.assertNoOrphans(
      queryRunner,
      'absence_requests',
      'employee_id',
      'FK_absence_requests_employee',
    );
    await this.assertNoOrphans(
      queryRunner,
      'employee_documents',
      'employee_id',
      'FK_employee_documents_employee',
    );
    await this.assertNoOrphans(
      queryRunner,
      'questionnaire_assignments',
      'employee_id',
      'FK_questionnaire_assignments_employee',
    );
    await this.assertNoOrphans(
      queryRunner,
      'questionnaire_assignments',
      'detached_from_employee_id',
      'FK_questionnaire_assignments_detached_from_employee',
    );

    await queryRunner.query(`
      ALTER TABLE "absence_requests"
      DROP CONSTRAINT IF EXISTS "FK_absence_requests_employee"
    `);
    await queryRunner.query(`
      ALTER TABLE "absence_requests"
      ADD CONSTRAINT "FK_absence_requests_employee"
      FOREIGN KEY ("employee_id") REFERENCES "employees"("id")
      ON DELETE RESTRICT
    `);

    await queryRunner.query(`
      ALTER TABLE "employee_documents"
      DROP CONSTRAINT IF EXISTS "FK_employee_documents_employee"
    `);
    await queryRunner.query(`
      ALTER TABLE "employee_documents"
      ADD CONSTRAINT "FK_employee_documents_employee"
      FOREIGN KEY ("employee_id") REFERENCES "employees"("id")
      ON DELETE RESTRICT
    `);

    await queryRunner.query(`
      ALTER TABLE "questionnaire_assignments"
      DROP CONSTRAINT IF EXISTS "FK_questionnaire_assignments_employee"
    `);
    await queryRunner.query(`
      ALTER TABLE "questionnaire_assignments"
      ADD CONSTRAINT "FK_questionnaire_assignments_employee"
      FOREIGN KEY ("employee_id") REFERENCES "employees"("id")
      ON DELETE RESTRICT
    `);

    await queryRunner.query(`
      ALTER TABLE "questionnaire_assignments"
      DROP CONSTRAINT IF EXISTS "FK_questionnaire_assignments_detached_from_employee"
    `);
    await queryRunner.query(`
      ALTER TABLE "questionnaire_assignments"
      ADD CONSTRAINT "FK_questionnaire_assignments_detached_from_employee"
      FOREIGN KEY ("detached_from_employee_id") REFERENCES "employees"("id")
      ON DELETE RESTRICT
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "file_deletion_outbox" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "storage_key" character varying(512) NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "processed_at" TIMESTAMPTZ,
        "attempts" integer NOT NULL DEFAULT 0,
        "last_error" text,
        CONSTRAINT "PK_file_deletion_outbox" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_file_deletion_outbox_pending"
      ON "file_deletion_outbox" ("created_at")
      WHERE "processed_at" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_file_deletion_outbox_pending"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "file_deletion_outbox"`);

    await queryRunner.query(`
      ALTER TABLE "questionnaire_assignments"
      DROP CONSTRAINT IF EXISTS "FK_questionnaire_assignments_detached_from_employee"
    `);
    await queryRunner.query(`
      ALTER TABLE "questionnaire_assignments"
      ADD CONSTRAINT "FK_questionnaire_assignments_detached_from_employee"
      FOREIGN KEY ("detached_from_employee_id") REFERENCES "employees"("id")
      ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "questionnaire_assignments"
      DROP CONSTRAINT IF EXISTS "FK_questionnaire_assignments_employee"
    `);
    await queryRunner.query(`
      ALTER TABLE "questionnaire_assignments"
      ADD CONSTRAINT "FK_questionnaire_assignments_employee"
      FOREIGN KEY ("employee_id") REFERENCES "employees"("id")
      ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "employee_documents"
      DROP CONSTRAINT IF EXISTS "FK_employee_documents_employee"
    `);
    await queryRunner.query(`
      ALTER TABLE "employee_documents"
      ADD CONSTRAINT "FK_employee_documents_employee"
      FOREIGN KEY ("employee_id") REFERENCES "employees"("id")
      ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "absence_requests"
      DROP CONSTRAINT IF EXISTS "FK_absence_requests_employee"
    `);
  }

  private async assertNoOrphans(
    queryRunner: QueryRunner,
    table: string,
    column: string,
    constraintName: string,
  ): Promise<void> {
    const rows = (await queryRunner.query(`
      SELECT COUNT(*)::int AS "count"
      FROM "${table}" AS t
      WHERE t."${column}" IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM "employees" AS e WHERE e."id" = t."${column}"
        )
    `)) as Array<{ count: number }>;
    const count = rows[0]?.count ?? 0;
    if (count > 0) {
      throw new Error(
        `Cannot add ${constraintName}: ${count} orphan row(s) in ${table}.${column}`,
      );
    }
  }
}
