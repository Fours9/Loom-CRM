import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Soft-hide inbox notifications without deleting rows (dismissed_at).
 */
export class NotificationsDismissedAt1730000029000
  implements MigrationInterface
{
  name = 'NotificationsDismissedAt1730000029000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "notifications"
        ADD COLUMN IF NOT EXISTS "dismissed_at" TIMESTAMPTZ NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_notifications_recipient_dismissed"
        ON "notifications" ("recipient_user_id", "dismissed_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_notifications_recipient_dismissed"`,
    );
    await queryRunner.query(`
      ALTER TABLE "notifications" DROP COLUMN IF EXISTS "dismissed_at"
    `);
  }
}
