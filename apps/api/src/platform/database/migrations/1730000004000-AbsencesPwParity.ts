import { MigrationInterface, QueryRunner } from 'typeorm';

export class AbsencesPwParity1730000004000 implements MigrationInterface {
  name = 'AbsencesPwParity1730000004000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "absence_requests"
        ADD COLUMN IF NOT EXISTS "position_id_at_submission" uuid,
        ADD COLUMN IF NOT EXISTS "employee_number_at_submission" character varying(64),
        ADD COLUMN IF NOT EXISTS "calendar_color_at_submission" character varying(32),
        ADD COLUMN IF NOT EXISTS "absence_start_time" character varying(8),
        ADD COLUMN IF NOT EXISTS "absence_end_time" character varying(8),
        ADD COLUMN IF NOT EXISTS "is_unpaid" boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "employee_comment" text,
        ADD COLUMN IF NOT EXISTS "adjustment_comment" text,
        ADD COLUMN IF NOT EXISTS "deletion_comment" text,
        ADD COLUMN IF NOT EXISTS "version" integer NOT NULL DEFAULT 1,
        ADD COLUMN IF NOT EXISTS "decided_at" TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS "decided_by_user_id" uuid,
        ADD COLUMN IF NOT EXISTS "status_before_deletion_request" character varying(32),
        ADD COLUMN IF NOT EXISTS "deletion_requested_at" TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS "deletion_requested_by_user_id" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "absence_attachments"
        ADD COLUMN IF NOT EXISTS "size_bytes" integer NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "content_base64" text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "absence_attachments"
        DROP COLUMN IF EXISTS "content_base64",
        DROP COLUMN IF EXISTS "size_bytes"
    `);
    await queryRunner.query(`
      ALTER TABLE "absence_requests"
        DROP COLUMN IF EXISTS "deletion_requested_by_user_id",
        DROP COLUMN IF EXISTS "deletion_requested_at",
        DROP COLUMN IF EXISTS "status_before_deletion_request",
        DROP COLUMN IF EXISTS "decided_by_user_id",
        DROP COLUMN IF EXISTS "decided_at",
        DROP COLUMN IF EXISTS "version",
        DROP COLUMN IF EXISTS "deletion_comment",
        DROP COLUMN IF EXISTS "adjustment_comment",
        DROP COLUMN IF EXISTS "employee_comment",
        DROP COLUMN IF EXISTS "is_unpaid",
        DROP COLUMN IF EXISTS "absence_end_time",
        DROP COLUMN IF EXISTS "absence_start_time",
        DROP COLUMN IF EXISTS "calendar_color_at_submission",
        DROP COLUMN IF EXISTS "employee_number_at_submission",
        DROP COLUMN IF EXISTS "position_id_at_submission"
    `);
  }
}
