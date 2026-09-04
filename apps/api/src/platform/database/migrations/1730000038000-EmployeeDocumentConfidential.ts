import { MigrationInterface, QueryRunner } from 'typeorm';

export class EmployeeDocumentConfidential1730000038000
  implements MigrationInterface
{
  name = 'EmployeeDocumentConfidential1730000038000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "employee_documents"
      ADD COLUMN "is_confidential" boolean NOT NULL DEFAULT false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "employee_documents"
      DROP COLUMN "is_confidential"
    `);
  }
}
