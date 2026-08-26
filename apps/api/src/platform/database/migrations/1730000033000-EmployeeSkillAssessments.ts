import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 6: employee_skill_assessments (confirmed profile matrix SoT) +
 * backfill questionnaire_profile_proposals.proposed_changes.kind = field_update.
 */
export class EmployeeSkillAssessments1730000033000
  implements MigrationInterface
{
  name = 'EmployeeSkillAssessments1730000033000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "employee_skill_assessments" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "employee_id" uuid NOT NULL,
        "skill_id" uuid NOT NULL,
        "assessment_type" character varying(32) NOT NULL,
        "level" integer,
        "assessed_by" uuid,
        "assessed_at" TIMESTAMPTZ NOT NULL,
        "source_submission_id" uuid,
        "source_assignment_id" uuid,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_employee_skill_assessments" PRIMARY KEY ("id"),
        CONSTRAINT "FK_esa_employee"
          FOREIGN KEY ("employee_id") REFERENCES "employees"("id")
          ON DELETE CASCADE,
        CONSTRAINT "FK_esa_skill"
          FOREIGN KEY ("skill_id") REFERENCES "skills"("id")
          ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_esa_employee" ON "employee_skill_assessments" ("employee_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_esa_skill" ON "employee_skill_assessments" ("skill_id")`,
    );
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_employee_skill_confirmed"
        ON "employee_skill_assessments" ("employee_id", "skill_id")
        WHERE "assessment_type" = 'confirmed'
    `);

    const legacy = (await queryRunner.query(`
      SELECT "id", "proposed_changes"
      FROM "questionnaire_profile_proposals"
      WHERE NOT ("proposed_changes" ? 'kind')
    `)) as Array<{ id: string; proposed_changes: unknown }>;

    for (const row of legacy) {
      const change =
        typeof row.proposed_changes === 'string'
          ? (JSON.parse(row.proposed_changes) as Record<string, unknown>)
          : (row.proposed_changes as Record<string, unknown> | null);
      if (!isLegacyFieldUpdateShape(change)) {
        throw new Error(
          `Malformed questionnaire_profile_proposals row ${row.id}: cannot backfill kind=field_update (missing section/field/answerKey/from/to)`,
        );
      }
    }

    await queryRunner.query(`
      UPDATE "questionnaire_profile_proposals"
      SET "proposed_changes" =
        jsonb_set("proposed_changes", '{kind}', '"field_update"'::jsonb)
      WHERE NOT ("proposed_changes" ? 'kind')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "questionnaire_profile_proposals"
      SET "proposed_changes" = "proposed_changes" - 'kind'
      WHERE "proposed_changes"->>'kind' = 'field_update'
    `);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "uq_employee_skill_confirmed"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "employee_skill_assessments"`);
  }
}

function isLegacyFieldUpdateShape(
  change: Record<string, unknown> | null | undefined,
): boolean {
  if (!change || typeof change !== 'object' || Array.isArray(change)) {
    return false;
  }
  if (typeof change['section'] !== 'string') return false;
  if (typeof change['field'] !== 'string') return false;
  if (typeof change['answerKey'] !== 'string') return false;
  if (!Object.prototype.hasOwnProperty.call(change, 'from')) return false;
  if (!Object.prototype.hasOwnProperty.call(change, 'to')) return false;
  return true;
}
