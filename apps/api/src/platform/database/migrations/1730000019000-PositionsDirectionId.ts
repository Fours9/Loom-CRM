import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Position Catalog PR3: positions.direction_id → directions(id) ON DELETE SET NULL.
 */
export class PositionsDirectionId1730000019000 implements MigrationInterface {
  name = 'PositionsDirectionId1730000019000';

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
