import { MigrationInterface, QueryRunner } from 'typeorm';
import { randomUUID } from 'crypto';

/**
 * Add absences.admin surface (permission-backed by absences.admin).
 * Seed grant for admin-equivalent account roles (catalog parity).
 */
export class AbsencesAdminSurface1730000046000 implements MigrationInterface {
  name = 'AbsencesAdminSurface1730000046000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `
      INSERT INTO "app_surfaces" ("id", "label_ua", "group_key", "sort_order")
      VALUES ('absences.admin', 'Відсутності — адміністрування', 'absences', 55)
      ON CONFLICT ("id") DO NOTHING
      `,
    );

    const roles: Array<{ id: string; is_admin_equivalent: boolean }> =
      await queryRunner.query(`
        SELECT "id", "is_admin_equivalent"
        FROM "account_roles"
      `);

    const affectedRoleIds: string[] = [];

    for (const role of roles) {
      if (role.is_admin_equivalent !== true) continue;

      const existing: Array<{ id: string }> = await queryRunner.query(
        `SELECT "id" FROM "account_role_surfaces"
         WHERE "account_role_id" = $1 AND "surface_id" = 'absences.admin'`,
        [role.id],
      );
      if (existing.length) continue;

      await queryRunner.query(
        `INSERT INTO "account_role_surfaces" ("id", "account_role_id", "surface_id")
         VALUES ($1, $2, 'absences.admin')`,
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
      `DELETE FROM "account_role_surfaces" WHERE "surface_id" = 'absences.admin'`,
    );
    await queryRunner.query(
      `DELETE FROM "app_surfaces" WHERE "id" = 'absences.admin'`,
    );
  }
}
