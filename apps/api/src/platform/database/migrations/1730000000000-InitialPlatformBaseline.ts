import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialPlatformBaseline1730000000000
  implements MigrationInterface
{
  name = 'InitialPlatformBaseline1730000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "application_settings" (
        "key" character varying(128) NOT NULL,
        "value" text NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_application_settings" PRIMARY KEY ("key")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "bootstrap_state" (
        "id" character varying(64) NOT NULL,
        "bootstrap_completed" boolean NOT NULL DEFAULT false,
        "completed_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_bootstrap_state" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      INSERT INTO "bootstrap_state" ("id", "bootstrap_completed", "completed_at")
      VALUES ('default', false, NULL)
      ON CONFLICT ("id") DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "bootstrap_state"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "application_settings"`);
  }
}
