import { MigrationInterface, QueryRunner } from 'typeorm';
import { randomUUID } from 'crypto';

/**
 * Expand Manage bundle to lifecycle ∧ delete ∧ apply_profile_changes.
 * Legacy L∧D∧!A is upgraded (INSERT Apply); XOR L/D and bare Apply fail closed.
 * Irreversible.
 */
export class QuestionnaireManageBundleApply1730000042000
  implements MigrationInterface
{
  name = 'QuestionnaireManageBundleApply1730000042000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Preflight: L XOR D (invalid old Manage)
    const xorRows: Array<{ c: string }> = await queryRunner.query(`
      SELECT COUNT(*)::text AS c
      FROM "account_roles" ar
      WHERE ar."is_admin_equivalent" = false
        AND (
          (
            EXISTS (
              SELECT 1 FROM "account_role_permissions" p
              WHERE p."account_role_id" = ar."id"
                AND p."permission" = 'questionnaires.manage_lifecycle'
            )
            AND NOT EXISTS (
              SELECT 1 FROM "account_role_permissions" p
              WHERE p."account_role_id" = ar."id"
                AND p."permission" = 'questionnaires.delete'
            )
          )
          OR (
            EXISTS (
              SELECT 1 FROM "account_role_permissions" p
              WHERE p."account_role_id" = ar."id"
                AND p."permission" = 'questionnaires.delete'
            )
            AND NOT EXISTS (
              SELECT 1 FROM "account_role_permissions" p
              WHERE p."account_role_id" = ar."id"
                AND p."permission" = 'questionnaires.manage_lifecycle'
            )
          )
        )
    `);
    if (Number(xorRows[0]?.c ?? 0) !== 0) {
      throw new Error(
        'QuestionnaireManageBundleApply: found role(s) with XOR(manage_lifecycle, delete). Fix partial Manage before migrating.',
      );
    }

    // Preflight: bare Apply without L∧D
    const bareApplyRows: Array<{ c: string }> = await queryRunner.query(`
      SELECT COUNT(*)::text AS c
      FROM "account_roles" ar
      WHERE ar."is_admin_equivalent" = false
        AND EXISTS (
          SELECT 1 FROM "account_role_permissions" p
          WHERE p."account_role_id" = ar."id"
            AND p."permission" = 'questionnaires.apply_profile_changes'
        )
        AND (
          NOT EXISTS (
            SELECT 1 FROM "account_role_permissions" p
            WHERE p."account_role_id" = ar."id"
              AND p."permission" = 'questionnaires.manage_lifecycle'
          )
          OR NOT EXISTS (
            SELECT 1 FROM "account_role_permissions" p
            WHERE p."account_role_id" = ar."id"
              AND p."permission" = 'questionnaires.delete'
          )
        )
    `);
    if (Number(bareApplyRows[0]?.c ?? 0) !== 0) {
      throw new Error(
        'QuestionnaireManageBundleApply: found role(s) with apply_profile_changes without lifecycle∧delete. Fix before migrating.',
      );
    }

    const affected: Array<{ id: string }> = await queryRunner.query(`
      SELECT ar."id"
      FROM "account_roles" ar
      WHERE ar."is_admin_equivalent" = false
        AND EXISTS (
          SELECT 1 FROM "account_role_permissions" p
          WHERE p."account_role_id" = ar."id"
            AND p."permission" = 'questionnaires.manage_lifecycle'
        )
        AND EXISTS (
          SELECT 1 FROM "account_role_permissions" p
          WHERE p."account_role_id" = ar."id"
            AND p."permission" = 'questionnaires.delete'
        )
        AND NOT EXISTS (
          SELECT 1 FROM "account_role_permissions" p
          WHERE p."account_role_id" = ar."id"
            AND p."permission" = 'questionnaires.apply_profile_changes'
        )
    `);

    const affectedRoleIds = affected.map((r) => r.id);

    for (const roleId of affectedRoleIds) {
      await queryRunner.query(
        `INSERT INTO "account_role_permissions" ("id", "account_role_id", "permission")
         VALUES ($1, $2, 'questionnaires.apply_profile_changes')`,
        [randomUUID(), roleId],
      );
    }

    // Postcondition: every non-adminEq is (L∧D∧A) | (!L∧!D∧!A)
    const partialRows: Array<{ c: string }> = await queryRunner.query(`
      SELECT COUNT(*)::text AS c
      FROM "account_roles" ar
      WHERE ar."is_admin_equivalent" = false
        AND (
          (
            SELECT COUNT(*) FROM "account_role_permissions" p
            WHERE p."account_role_id" = ar."id"
              AND p."permission" IN (
                'questionnaires.manage_lifecycle',
                'questionnaires.delete',
                'questionnaires.apply_profile_changes'
              )
          ) NOT IN (0, 3)
        )
    `);
    if (Number(partialRows[0]?.c ?? 0) !== 0) {
      throw new Error(
        'QuestionnaireManageBundleApply: postcondition failed — partial Manage triple remains.',
      );
    }

    if (affectedRoleIds.length) {
      await queryRunner.query(
        `UPDATE "users" SET "token_version" = "token_version" + 1
         WHERE "account_role_id" = ANY($1::uuid[])`,
        [affectedRoleIds],
      );
    }
  }

  public async down(): Promise<void> {
    // Irreversible: seeded Apply cannot be safely stripped without knowing prior state.
  }
}
