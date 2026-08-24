import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Employment assignment free-text field: change_reason → comment
 * (UI/API/domain name alignment).
 */
export class EmploymentAssignmentComment1730000032000
  implements MigrationInterface
{
  name = 'EmploymentAssignmentComment1730000032000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "employment_assignments"
        RENAME COLUMN "change_reason" TO "comment"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "employment_assignments"
        RENAME COLUMN "comment" TO "change_reason"
    `);
  }
}
