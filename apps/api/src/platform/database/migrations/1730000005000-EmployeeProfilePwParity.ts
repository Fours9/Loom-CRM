import { MigrationInterface, QueryRunner } from 'typeorm';

/** PW employee profile / privacy override columns for cutover parity. */
export class EmployeeProfilePwParity1730000005000 implements MigrationInterface {
  name = 'EmployeeProfilePwParity1730000005000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "employees"
        ADD COLUMN IF NOT EXISTS "phone_number" text,
        ADD COLUMN IF NOT EXISTS "telegram" text,
        ADD COLUMN IF NOT EXISTS "personal_phone_number" text,
        ADD COLUMN IF NOT EXISTS "personal_telegram" text,
        ADD COLUMN IF NOT EXISTS "personal_email" text,
        ADD COLUMN IF NOT EXISTS "comment" text,
        ADD COLUMN IF NOT EXISTS "admin_comment" text,
        ADD COLUMN IF NOT EXISTS "photo_url" text,
        ADD COLUMN IF NOT EXISTS "profile_visibility_override" text,
        ADD COLUMN IF NOT EXISTS "absence_visibility_override" text,
        ADD COLUMN IF NOT EXISTS "show_absence_type_to_peers_override" text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "employees"
        DROP COLUMN IF EXISTS "phone_number",
        DROP COLUMN IF EXISTS "telegram",
        DROP COLUMN IF EXISTS "personal_phone_number",
        DROP COLUMN IF EXISTS "personal_telegram",
        DROP COLUMN IF EXISTS "personal_email",
        DROP COLUMN IF EXISTS "comment",
        DROP COLUMN IF EXISTS "admin_comment",
        DROP COLUMN IF EXISTS "photo_url",
        DROP COLUMN IF EXISTS "profile_visibility_override",
        DROP COLUMN IF EXISTS "absence_visibility_override",
        DROP COLUMN IF EXISTS "show_absence_type_to_peers_override"
    `);
  }
}
