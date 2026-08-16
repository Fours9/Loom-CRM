import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Restore positions.direction_id:
 * - when department_id set → direction inherited from department (synced in app)
 * - when department_id null → direction optional / manual
 */
export class RestorePositionDirectionId1730000023000
  implements MigrationInterface
{
  name = 'RestorePositionDirectionId1730000023000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "positions"
      ADD COLUMN IF NOT EXISTS "direction_id" uuid
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_positions_direction"
      ON "positions" ("direction_id")
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_positions_direction'
        ) THEN
          ALTER TABLE "positions"
          ADD CONSTRAINT "FK_positions_direction"
          FOREIGN KEY ("direction_id") REFERENCES "directions"("id")
          ON DELETE SET NULL;
        END IF;
      END $$
    `);

    // Sync from department when present
    await queryRunner.query(`
      UPDATE "positions" p
      SET "direction_id" = d."direction_id"
      FROM "departments" d
      WHERE p."department_id" = d."id"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "positions" DROP CONSTRAINT IF EXISTS "FK_positions_direction"
    `);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_positions_direction"`);
    await queryRunner.query(`
      ALTER TABLE "positions" DROP COLUMN IF EXISTS "direction_id"
    `);
  }
}
