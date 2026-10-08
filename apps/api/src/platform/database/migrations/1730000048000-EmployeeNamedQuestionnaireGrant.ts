import { MigrationInterface, QueryRunner } from 'typeorm';
import { randomUUID } from 'crypto';

/**
 * Grant published `employee-named` (Іменна) to every non-adminEq role that
 * already holds `employee-starter` or `employee-360` (same full-template class).
 * Conflict-safe; bumps role tokens only when a grant row is inserted.
 */
export class EmployeeNamedQuestionnaireGrant1730000048000
  implements MigrationInterface
{
  name = 'EmployeeNamedQuestionnaireGrant1730000048000';

  private static readonly CODE = 'employee-named';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const roles: Array<{ id: string }> = await queryRunner.query(
      `
      SELECT DISTINCT ar."id" AS "id"
      FROM "account_roles" ar
      INNER JOIN "account_role_questionnaire_templates" g
        ON g."account_role_id" = ar."id"
      WHERE ar."is_admin_equivalent" = false
        AND g."template_code" IN ('employee-starter', 'employee-360')
      `,
    );

    const changedRoleIds = new Set<string>();

    for (const role of roles) {
      const existing: Array<{ id: string }> = await queryRunner.query(
        `SELECT "id" FROM "account_role_questionnaire_templates"
         WHERE "account_role_id" = $1 AND "template_code" = $2`,
        [role.id, EmployeeNamedQuestionnaireGrant1730000048000.CODE],
      );
      if (existing.length) continue;

      await queryRunner.query(
        `INSERT INTO "account_role_questionnaire_templates"
           ("id", "account_role_id", "template_code")
         VALUES ($1, $2, $3)`,
        [
          randomUUID(),
          role.id,
          EmployeeNamedQuestionnaireGrant1730000048000.CODE,
        ],
      );
      changedRoleIds.add(role.id);
    }

    if (changedRoleIds.size) {
      await queryRunner.query(
        `UPDATE "users" SET "token_version" = "token_version" + 1
         WHERE "account_role_id" = ANY($1::uuid[])`,
        [[...changedRoleIds]],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "account_role_questionnaire_templates"
       WHERE "template_code" = $1`,
      [EmployeeNamedQuestionnaireGrant1730000048000.CODE],
    );
  }
}
