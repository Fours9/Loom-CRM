import { MigrationInterface, QueryRunner } from 'typeorm';
import { randomUUID } from 'crypto';

/**
 * Add people.tab.about («Про себе») surface.
 * Seed: employee + adminEq roles (soft voluntary context; DM/director opt-in via Settings).
 * people.tab.later stays reserved (no grant changes).
 */
export class PeopleTabAboutSurface1730000043000 implements MigrationInterface {
  name = 'PeopleTabAboutSurface1730000043000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `
      INSERT INTO "app_surfaces" ("id", "label_ua", "group_key", "sort_order")
      VALUES ('people.tab.about', 'Профіль — Про себе', 'people', 45)
      ON CONFLICT ("id") DO NOTHING
      `,
    );

    const roles: Array<{ id: string; code: string | null; is_admin_equivalent: boolean }> =
      await queryRunner.query(`
        SELECT "id", "code", "is_admin_equivalent"
        FROM "account_roles"
      `);

    const affectedRoleIds: string[] = [];

    for (const role of roles) {
      const grant =
        role.is_admin_equivalent === true || role.code === 'employee';
      if (!grant) continue;

      const existing: Array<{ id: string }> = await queryRunner.query(
        `SELECT "id" FROM "account_role_surfaces"
         WHERE "account_role_id" = $1 AND "surface_id" = 'people.tab.about'`,
        [role.id],
      );
      if (existing.length) continue;

      await queryRunner.query(
        `INSERT INTO "account_role_surfaces" ("id", "account_role_id", "surface_id")
         VALUES ($1, $2, 'people.tab.about')`,
        [randomUUID(), role.id],
      );
      affectedRoleIds.push(role.id);
    }

    if (affectedRoleIds.length) {
      await queryRunner.query(
        `UPDATE "users" SET "token_version" = "token_version" + 1
         WHERE "account_role_id" = ANY($1::uuid[])`,
        [affectedRoleIds],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "account_role_surfaces" WHERE "surface_id" = 'people.tab.about'`,
    );
    await queryRunner.query(
      `DELETE FROM "app_surfaces" WHERE "id" = 'people.tab.about'`,
    );
  }
}
