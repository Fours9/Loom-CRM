import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Employee documents MVP: metadata + interim base64 storage (until Platform Files).
 */
export class EmployeeDocuments1730000009000 implements MigrationInterface {
  name = 'EmployeeDocuments1730000009000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "employee_documents" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "employee_id" uuid NOT NULL,
        "document_type" character varying(32) NOT NULL,
        "title" character varying(255) NOT NULL,
        "file_name" character varying(255) NOT NULL,
        "mime_type" character varying(128),
        "size_bytes" integer NOT NULL DEFAULT 0,
        "content_base64" text,
        "storage_key" character varying(512) NOT NULL,
        "created_by_user_id" uuid,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMPTZ,
        CONSTRAINT "PK_employee_documents" PRIMARY KEY ("id"),
        CONSTRAINT "FK_employee_documents_employee"
          FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_employee_documents_created_by"
          FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL,
        CONSTRAINT "CHK_employee_documents_type" CHECK (
          "document_type" IN (
            'employment',
            'questionnaire',
            'identity',
            'education',
            'certificate',
            'medical',
            'consent',
            'other'
          )
        ),
        CONSTRAINT "CHK_employee_documents_size" CHECK ("size_bytes" >= 0)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_employee_documents_employee"
      ON "employee_documents" ("employee_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_employee_documents_active"
      ON "employee_documents" ("employee_id", "created_at" DESC)
      WHERE "deleted_at" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_employee_documents_active"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_employee_documents_employee"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "employee_documents"`);
  }
}
