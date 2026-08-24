import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Split employee document submission (title/type) from file blobs so one
 * submission can hold multiple attachments (absence-attachment parity).
 */
export class EmployeeDocumentFiles1730000030000 implements MigrationInterface {
  name = 'EmployeeDocumentFiles1730000030000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "employee_document_files" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "document_id" uuid NOT NULL,
        "file_name" character varying(255) NOT NULL,
        "mime_type" character varying(128),
        "size_bytes" integer NOT NULL DEFAULT 0,
        "content_base64" text,
        "storage_key" character varying(512) NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_employee_document_files" PRIMARY KEY ("id"),
        CONSTRAINT "FK_employee_document_files_document"
          FOREIGN KEY ("document_id") REFERENCES "employee_documents"("id")
          ON DELETE CASCADE,
        CONSTRAINT "CHK_employee_document_files_size" CHECK ("size_bytes" >= 0)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_employee_document_files_document"
      ON "employee_document_files" ("document_id")
    `);

    await queryRunner.query(`
      INSERT INTO "employee_document_files" (
        "id",
        "document_id",
        "file_name",
        "mime_type",
        "size_bytes",
        "content_base64",
        "storage_key",
        "created_at"
      )
      SELECT
        d."id",
        d."id",
        d."file_name",
        d."mime_type",
        d."size_bytes",
        d."content_base64",
        d."storage_key",
        d."created_at"
      FROM "employee_documents" d
      WHERE NOT EXISTS (
        SELECT 1 FROM "employee_document_files" f WHERE f."document_id" = d."id"
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "employee_documents"
        DROP CONSTRAINT IF EXISTS "CHK_employee_documents_size"
    `);
    await queryRunner.query(`
      ALTER TABLE "employee_documents" DROP COLUMN IF EXISTS "file_name"
    `);
    await queryRunner.query(`
      ALTER TABLE "employee_documents" DROP COLUMN IF EXISTS "mime_type"
    `);
    await queryRunner.query(`
      ALTER TABLE "employee_documents" DROP COLUMN IF EXISTS "size_bytes"
    `);
    await queryRunner.query(`
      ALTER TABLE "employee_documents" DROP COLUMN IF EXISTS "content_base64"
    `);
    await queryRunner.query(`
      ALTER TABLE "employee_documents" DROP COLUMN IF EXISTS "storage_key"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "employee_documents"
        ADD COLUMN IF NOT EXISTS "file_name" character varying(255),
        ADD COLUMN IF NOT EXISTS "mime_type" character varying(128),
        ADD COLUMN IF NOT EXISTS "size_bytes" integer NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "content_base64" text,
        ADD COLUMN IF NOT EXISTS "storage_key" character varying(512)
    `);

    await queryRunner.query(`
      UPDATE "employee_documents" AS d
      SET
        "file_name" = f."file_name",
        "mime_type" = f."mime_type",
        "size_bytes" = f."size_bytes",
        "content_base64" = f."content_base64",
        "storage_key" = f."storage_key"
      FROM (
        SELECT DISTINCT ON ("document_id")
          "document_id",
          "file_name",
          "mime_type",
          "size_bytes",
          "content_base64",
          "storage_key"
        FROM "employee_document_files"
        ORDER BY "document_id", "created_at" ASC
      ) AS f
      WHERE d."id" = f."document_id"
    `);

    await queryRunner.query(`
      UPDATE "employee_documents"
      SET
        "file_name" = COALESCE("file_name", 'file'),
        "storage_key" = COALESCE("storage_key", 'db:employee-document:' || "id")
      WHERE "file_name" IS NULL OR "storage_key" IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "employee_documents"
        ALTER COLUMN "file_name" SET NOT NULL,
        ALTER COLUMN "storage_key" SET NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "employee_documents"
        ADD CONSTRAINT "CHK_employee_documents_size" CHECK ("size_bytes" >= 0)
    `);

    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_employee_document_files_document"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "employee_document_files"`);
  }
}
