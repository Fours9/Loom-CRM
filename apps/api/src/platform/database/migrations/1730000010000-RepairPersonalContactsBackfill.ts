import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Idempotent repair: ensure legacy personal_* columns have matching employee_contacts rows.
 */
export class RepairPersonalContactsBackfill1730000010000
  implements MigrationInterface
{
  name = 'RepairPersonalContactsBackfill1730000010000';

  public async up(queryRunner: QueryRunner): Promise<void> {
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
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Repair migration — no destructive down.
  }
}
