import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Employment catalogs: free-text description; sort_order stays for drag-reorder.
 */
export class EmploymentCatalogDescription1730000031000
  implements MigrationInterface
{
  name = 'EmploymentCatalogDescription1730000031000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "work_formats"
        ADD COLUMN IF NOT EXISTS "description" text NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "employment_types"
        ADD COLUMN IF NOT EXISTS "description" text NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "employment_types" DROP COLUMN IF EXISTS "description"
    `);
    await queryRunner.query(`
      ALTER TABLE "work_formats" DROP COLUMN IF EXISTS "description"
    `);
  }
}
