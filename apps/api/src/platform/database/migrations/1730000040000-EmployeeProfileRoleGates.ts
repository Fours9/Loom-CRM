import { MigrationInterface, QueryRunner } from 'typeorm';
import { randomUUID } from 'crypto';

/**
 * Collapse employees.edit extras → employees.manage_profiles;
 * seed manage_profiles on all department_manager-preset roles (Variant A);
 * bump token_version for affected users. Irreversible.
 */
export class EmployeeProfileRoleGates1730000040000
  implements MigrationInterface
{
  name = 'EmployeeProfileRoleGates1730000040000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1) edit → manage_profiles (upsert), then drop edit rows
    const editRows: Array<{ account_role_id: string }> = await queryRunner.query(
      `SELECT DISTINCT "account_role_id" FROM "account_role_permissions"
       WHERE "permission" = 'employees.edit'`,
    );
    for (const row of editRows) {
      const existing: Array<{ id: string }> = await queryRunner.query(
        `SELECT "id" FROM "account_role_permissions"
         WHERE "account_role_id" = $1 AND "permission" = 'employees.manage_profiles'`,
        [row.account_role_id],
      );
      if (!existing.length) {
        await queryRunner.query(
          `INSERT INTO "account_role_permissions" ("id", "account_role_id", "permission")
           VALUES ($1, $2, 'employees.manage_profiles')`,
          [randomUUID(), row.account_role_id],
        );
      }
    }
    await queryRunner.query(
      `DELETE FROM "account_role_permissions" WHERE "permission" = 'employees.edit'`,
    );

    // 2) Seed manage_profiles on every department_manager-preset role
    const dmRoles: Array<{ id: string }> = await queryRunner.query(
      `SELECT "id" FROM "account_roles" WHERE "permission_preset" = 'department_manager'`,
    );
    for (const role of dmRoles) {
      const existing: Array<{ id: string }> = await queryRunner.query(
        `SELECT "id" FROM "account_role_permissions"
         WHERE "account_role_id" = $1 AND "permission" = 'employees.manage_profiles'`,
        [role.id],
      );
      if (!existing.length) {
        await queryRunner.query(
          `INSERT INTO "account_role_permissions" ("id", "account_role_id", "permission")
           VALUES ($1, $2, 'employees.manage_profiles')`,
          [randomUUID(), role.id],
        );
      }
    }

    // 3) Token bump: all users on department_manager-preset roles + roles that
    //    gained/lost edit/manage_profiles in this migration (covered by DM preset).
    await queryRunner.query(`
      UPDATE "users" u
      SET "token_version" = u."token_version" + 1
      FROM "account_roles" ar
      WHERE u."account_role_id" = ar."id"
        AND ar."permission_preset" = 'department_manager'
    `);

    // Post-assert: no employees.edit leftovers
    const leftover: Array<{ c: string }> = await queryRunner.query(
      `SELECT COUNT(*)::text AS c FROM "account_role_permissions"
       WHERE "permission" = 'employees.edit'`,
    );
    if (Number(leftover[0]?.c ?? 0) !== 0) {
      throw new Error(
        'EmployeeProfileRoleGates: employees.edit extras still present after migration',
      );
    }
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    throw new Error(
      'EmployeeProfileRoleGates1730000040000 is irreversible (permission collapse)',
    );
  }
}
