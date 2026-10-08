import { MigrationInterface, QueryRunner } from 'typeorm';
import { randomUUID } from 'crypto';

/**
 * Seed Class C extras (read_team_comment + export_profile) on non-adminEq
 * department_manager-preset roles (covers director + DM + custom DM-preset).
 * Conflict-safe; token bump only for roles that gained a row.
 */
export class EmployeeAccessFieldToggles1730000047000
  implements MigrationInterface
{
  name = 'EmployeeAccessFieldToggles1730000047000';

  private static readonly PERMS = [
    'employees.read_team_comment',
    'employees.export_profile',
  ] as const;

  public async up(queryRunner: QueryRunner): Promise<void> {
    const roles: Array<{ id: string }> = await queryRunner.query(`
      SELECT "id" FROM "account_roles"
      WHERE "permission_preset" = 'department_manager'
        AND "is_admin_equivalent" = false
    `);

    const changedRoleIds = new Set<string>();

    for (const role of roles) {
      for (const permission of EmployeeAccessFieldToggles1730000047000.PERMS) {
        const existing: Array<{ id: string }> = await queryRunner.query(
          `SELECT "id" FROM "account_role_permissions"
           WHERE "account_role_id" = $1 AND "permission" = $2`,
          [role.id, permission],
        );
        if (existing.length) continue;

        await queryRunner.query(
          `INSERT INTO "account_role_permissions" ("id", "account_role_id", "permission")
           VALUES ($1, $2, $3)`,
          [randomUUID(), role.id, permission],
        );
        changedRoleIds.add(role.id);
      }
    }

    if (changedRoleIds.size) {
      await queryRunner.query(
        `UPDATE "users" SET "token_version" = "token_version" + 1
         WHERE "account_role_id" = ANY($1::uuid[])`,
        [[...changedRoleIds]],
      );
    }

    for (const role of roles) {
      for (const permission of EmployeeAccessFieldToggles1730000047000.PERMS) {
        const rows: Array<{ c: string }> = await queryRunner.query(
          `SELECT COUNT(*)::text AS c FROM "account_role_permissions"
           WHERE "account_role_id" = $1 AND "permission" = $2`,
          [role.id, permission],
        );
        if (Number(rows[0]?.c ?? 0) < 1) {
          throw new Error(
            `EmployeeAccessFieldToggles: missing ${permission} on role ${role.id}`,
          );
        }
      }
    }
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    throw new Error(
      'EmployeeAccessFieldToggles1730000047000 is irreversible',
    );
  }
}
