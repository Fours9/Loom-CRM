import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Org hierarchy: Department → Direction (optional), Position → Department (optional).
 * Removes Position.direction_id (direction is inherited via department when set).
 */
export class DepartmentBelongsToDirection1730000022000
  implements MigrationInterface
{
  name = 'DepartmentBelongsToDirection1730000022000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "departments"
      ADD COLUMN IF NOT EXISTS "direction_id" uuid
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_departments_direction_id"
      ON "departments" ("direction_id")
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "departments"
        ADD CONSTRAINT "FK_departments_direction"
        FOREIGN KEY ("direction_id") REFERENCES "directions"("id")
        ON DELETE SET NULL;
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$
    `);

    // Best-effort: if a department's positions shared a direction, copy onto department.
    await queryRunner.query(`
      UPDATE "departments" d
      SET "direction_id" = sub."direction_id"
      FROM (
        SELECT DISTINCT ON ("department_id")
          "department_id",
          "direction_id"
        FROM "positions"
        WHERE "department_id" IS NOT NULL
          AND "direction_id" IS NOT NULL
        ORDER BY "department_id", "updated_at" DESC NULLS LAST
      ) sub
      WHERE d."id" = sub."department_id"
        AND d."direction_id" IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "positions" DROP CONSTRAINT IF EXISTS "FK_positions_direction"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_positions_direction"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_positions_direction_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "positions" DROP COLUMN IF EXISTS "direction_id"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "positions"
      ADD COLUMN IF NOT EXISTS "direction_id" uuid
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_positions_direction_id"
      ON "positions" ("direction_id")
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "positions"
        ADD CONSTRAINT "FK_positions_direction"
        FOREIGN KEY ("direction_id") REFERENCES "directions"("id")
        ON DELETE SET NULL;
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$
    `);

    await queryRunner.query(`
      UPDATE "positions" p
      SET "direction_id" = d."direction_id"
      FROM "departments" d
      WHERE p."department_id" = d."id"
        AND p."direction_id" IS NULL
        AND d."direction_id" IS NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "departments" DROP CONSTRAINT IF EXISTS "FK_departments_direction"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_departments_direction_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "departments" DROP COLUMN IF EXISTS "direction_id"
    `);
  }
}
