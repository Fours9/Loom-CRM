import { MigrationInterface, QueryRunner } from 'typeorm';

export class IdentityAndPlatform1730000001000 implements MigrationInterface {
  name = 'IdentityAndPlatform1730000001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "email" character varying(320) NOT NULL,
        "password_hash" character varying(255) NOT NULL,
        "role" character varying(64) NOT NULL,
        "is_department_manager" boolean NOT NULL DEFAULT false,
        "status" character varying(32) NOT NULL DEFAULT 'active',
        "must_change_password" boolean NOT NULL DEFAULT true,
        "password_changed_at" TIMESTAMPTZ,
        "token_version" integer NOT NULL DEFAULT 0,
        "last_login_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_users" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_users_email" UNIQUE ("email")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "audit_logs" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "actor_user_id" uuid,
        "action" character varying(128) NOT NULL,
        "entity_type" character varying(64) NOT NULL,
        "entity_id" character varying(64),
        "metadata" jsonb,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_audit_logs" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_logs_actor" ON "audit_logs" ("actor_user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_audit_logs_entity" ON "audit_logs" ("entity_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "notifications" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "recipient_user_id" uuid NOT NULL,
        "type" character varying(128) NOT NULL,
        "title" character varying(255) NOT NULL,
        "body" text NOT NULL,
        "payload" jsonb,
        "is_read" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_notifications" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_notifications_recipient" ON "notifications" ("recipient_user_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "notifications"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_logs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
  }
}
