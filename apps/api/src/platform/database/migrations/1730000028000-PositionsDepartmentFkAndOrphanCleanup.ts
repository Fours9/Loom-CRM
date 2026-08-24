import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * positions.department_id historically had no DB FK (entity already declares
 * onDelete: SET NULL). Deleted departments left active positions orphaned;
 * People org-catalog selectability then hid them as hierarchy_changed.
 */
export class PositionsDepartmentFkAndOrphanCleanup1730000028000
  implements MigrationInterface
{
  name = 'PositionsDepartmentFkAndOrphanCleanup1730000028000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "positions" AS p
      SET "department_id" = NULL
      WHERE p."department_id" IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM "departments" AS d WHERE d."id" = p."department_id"
        )
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_positions_department'
        ) THEN
          ALTER TABLE "positions"
            ADD CONSTRAINT "FK_positions_department"
            FOREIGN KEY ("department_id") REFERENCES "departments"("id")
            ON DELETE SET NULL;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "positions" DROP CONSTRAINT IF EXISTS "FK_positions_department"
    `);
  }
}
