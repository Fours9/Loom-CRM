import { MigrationInterface, QueryRunner } from 'typeorm';

export class AbsencesModule1730000003000 implements MigrationInterface {
  name = 'AbsencesModule1730000003000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "absence_requests" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "employee_id" uuid NOT NULL,
        "department_id_at_submission" uuid,
        "employee_name_at_submission" character varying(255) NOT NULL,
        "type" character varying(32) NOT NULL,
        "start_date" date NOT NULL,
        "end_date" date,
        "reason" text,
        "status" character varying(32) NOT NULL DEFAULT 'pending',
        "created_by_user_id" uuid NOT NULL,
        "decision_comment" text,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_absence_requests" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_absence_requests_employee" ON "absence_requests" ("employee_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "absence_request_history" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "request_id" uuid NOT NULL,
        "action" character varying(64) NOT NULL,
        "actor_user_id" uuid,
        "comment" text,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_absence_request_history" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_absence_history_request" ON "absence_request_history" ("request_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "absence_attachments" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "request_id" uuid NOT NULL,
        "file_name" character varying(255) NOT NULL,
        "storage_key" character varying(512) NOT NULL,
        "mime_type" character varying(128),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_absence_attachments" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_absence_attachments_request" ON "absence_attachments" ("request_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "absence_attachments"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "absence_request_history"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "absence_requests"`);
  }
}
