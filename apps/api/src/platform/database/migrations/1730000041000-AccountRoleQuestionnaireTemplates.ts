import { MigrationInterface, QueryRunner } from 'typeorm';
import { randomUUID } from 'crypto';

const BUILTIN_FULL = ['employee-starter', 'employee-360'] as const;
const BUILTIN_ALL = [
  'employee-starter',
  'employee-360',
  'employee-managing',
  'employee-docs',
] as const;

const ELEVATED_EXTRAS = [
  'questionnaires.assign',
  'questionnaires.manage_lifecycle',
  'questionnaires.complete.any',
  'questionnaires.delete',
] as const;

/**
 * AccountRole ↔ questionnaire template-code grants + Variant A Assign
 * (Assign off DM preset → extras for DM-preset roles) + Manage-bundle preflight.
 * Irreversible.
 */
export class AccountRoleQuestionnaireTemplates1730000041000
  implements MigrationInterface
{
  name = 'AccountRoleQuestionnaireTemplates1730000041000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- Preflight: lifecycle XOR delete extras (non-adminEq) ---
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
        'AccountRoleQuestionnaireTemplates: found role(s) with XOR(questionnaires.manage_lifecycle, questionnaires.delete). Fix partial Manage bundle before migrating.',
      );
    }

    await queryRunner.query(`
      CREATE TABLE "account_role_questionnaire_templates" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "account_role_id" uuid NOT NULL,
        "template_code" character varying(64) NOT NULL,
        CONSTRAINT "PK_account_role_questionnaire_templates"
          PRIMARY KEY ("id"),
        CONSTRAINT "UQ_arqt_role_code"
          UNIQUE ("account_role_id", "template_code"),
        CONSTRAINT "FK_arqt_account_role"
          FOREIGN KEY ("account_role_id")
          REFERENCES "account_roles"("id")
          ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_arqt_account_role_id"
        ON "account_role_questionnaire_templates" ("account_role_id")
    `);

    const roles: Array<{
      id: string;
      permission_preset: string;
      is_admin_equivalent: boolean;
    }> = await queryRunner.query(`
      SELECT "id", "permission_preset", "is_admin_equivalent"
      FROM "account_roles"
    `);

    const affectedRoleIds = new Set<string>();

    for (const role of roles) {
      if (role.is_admin_equivalent) {
        continue;
      }

      const extras: Array<{ permission: string }> = await queryRunner.query(
        `SELECT "permission" FROM "account_role_permissions"
         WHERE "account_role_id" = $1`,
        [role.id],
      );
      const extraSet = new Set(extras.map((e) => e.permission));

      const elevatedBefore =
        role.permission_preset === 'department_manager' ||
        ELEVATED_EXTRAS.some((p) => extraSet.has(p));

      const literals = elevatedBefore ? BUILTIN_ALL : BUILTIN_FULL;
      for (const code of literals) {
        await this.insertGrant(queryRunner, role.id, code);
      }
      affectedRoleIds.add(role.id);

      // Upgrade-only: existing published templates
      if (elevatedBefore) {
        const published: Array<{ code: string }> = await queryRunner.query(`
          SELECT "code" FROM "questionnaire_templates"
          WHERE "status" = 'published'
        `);
        for (const row of published) {
          await this.insertGrant(queryRunner, role.id, row.code);
        }
      } else {
        const fullPublished: Array<{ code: string }> = await queryRunner.query(`
          SELECT "code" FROM "questionnaire_templates"
          WHERE "status" = 'published' AND "type" = 'full'
        `);
        for (const row of fullPublished) {
          await this.insertGrant(queryRunner, role.id, row.code);
        }
      }
    }

    // Variant A: seed questionnaires.assign extra for DM-preset non-adminEq roles
    const dmRoles: Array<{ id: string }> = await queryRunner.query(`
      SELECT "id" FROM "account_roles"
      WHERE "permission_preset" = 'department_manager'
        AND "is_admin_equivalent" = false
    `);
    for (const role of dmRoles) {
      const existing: Array<{ id: string }> = await queryRunner.query(
        `SELECT "id" FROM "account_role_permissions"
         WHERE "account_role_id" = $1 AND "permission" = 'questionnaires.assign'`,
        [role.id],
      );
      if (!existing.length) {
        await queryRunner.query(
          `INSERT INTO "account_role_permissions" ("id", "account_role_id", "permission")
           VALUES ($1, $2, 'questionnaires.assign')`,
          [randomUUID(), role.id],
        );
        affectedRoleIds.add(role.id);
      }
    }

    // Invalidate sessions for affected roles
    if (affectedRoleIds.size > 0) {
      const ids = [...affectedRoleIds];
      await queryRunner.query(
        `
        UPDATE "users"
        SET "token_version" = "token_version" + 1
        WHERE "account_role_id" = ANY($1::uuid[])
        `,
        [ids],
      );
    }
  }

  private async insertGrant(
    queryRunner: QueryRunner,
    accountRoleId: string,
    templateCode: string,
  ): Promise<void> {
    const existing: Array<{ id: string }> = await queryRunner.query(
      `SELECT "id" FROM "account_role_questionnaire_templates"
       WHERE "account_role_id" = $1 AND "template_code" = $2`,
      [accountRoleId, templateCode],
    );
    if (existing.length) return;
    await queryRunner.query(
      `INSERT INTO "account_role_questionnaire_templates"
         ("id", "account_role_id", "template_code")
       VALUES ($1, $2, $3)`,
      [randomUUID(), accountRoleId, templateCode],
    );
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    throw new Error(
      'AccountRoleQuestionnaireTemplates1730000041000 is irreversible',
    );
  }
}
