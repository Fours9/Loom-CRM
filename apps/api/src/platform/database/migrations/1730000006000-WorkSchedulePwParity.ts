import { MigrationInterface, QueryRunner } from 'typeorm';

/** Align work_schedule_days with ProjectWeekend (is_working_day + breaks + note). */
export class WorkSchedulePwParity1730000006000 implements MigrationInterface {
  name = 'WorkSchedulePwParity1730000006000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "work_schedule_days"
        ADD COLUMN IF NOT EXISTS "is_working_day" boolean NOT NULL DEFAULT true,
        ADD COLUMN IF NOT EXISTS "break_start" character varying(8),
        ADD COLUMN IF NOT EXISTS "break_end" character varying(8),
        ADD COLUMN IF NOT EXISTS "note" text
    `);
    await queryRunner.query(`
      UPDATE "work_schedule_days"
      SET "is_working_day" = NOT COALESCE("is_day_off", false)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "work_schedule_days"
        DROP COLUMN IF EXISTS "note",
        DROP COLUMN IF EXISTS "break_end",
        DROP COLUMN IF EXISTS "break_start",
        DROP COLUMN IF EXISTS "is_working_day"
    `);
  }
}
