import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * - Allow proposal status `superseded` (system resolution, not human reject).
 * - At most one pending proposal per employee + target_section + field.
 */
export class QuestionnaireProposalSuperseded1730000012000
  implements MigrationInterface
{
  name = 'QuestionnaireProposalSuperseded1730000012000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "questionnaire_profile_proposals"
      DROP CONSTRAINT IF EXISTS "CHK_questionnaire_profile_proposals_status"
    `);
    await queryRunner.query(`
      ALTER TABLE "questionnaire_profile_proposals"
      ADD CONSTRAINT "CHK_questionnaire_profile_proposals_status" CHECK (
        "status" IN ('pending', 'accepted', 'rejected', 'superseded')
      )
    `);
    // Collapse duplicate pending rows before unique index (keep newest).
    await queryRunner.query(`
      WITH ranked AS (
        SELECT
          id,
          ROW_NUMBER() OVER (
            PARTITION BY
              employee_id,
              target_section,
              (proposed_changes->>'field')
            ORDER BY created_at DESC, id DESC
          ) AS rn
        FROM questionnaire_profile_proposals
        WHERE status = 'pending'
      )
      UPDATE questionnaire_profile_proposals p
      SET
        status = 'superseded',
        reviewed_at = NOW(),
        reviewed_by_user_id = NULL
      FROM ranked r
      WHERE p.id = r.id AND r.rn > 1
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS
        "UQ_questionnaire_proposals_pending_employee_field"
      ON "questionnaire_profile_proposals" (
        "employee_id",
        "target_section",
        ((proposed_changes->>'field'))
      )
      WHERE "status" = 'pending'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "questionnaire_profile_proposals"
      SET "status" = 'rejected'
      WHERE "status" = 'superseded'
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "UQ_questionnaire_proposals_pending_employee_field"
    `);
    await queryRunner.query(`
      ALTER TABLE "questionnaire_profile_proposals"
      DROP CONSTRAINT IF EXISTS "CHK_questionnaire_profile_proposals_status"
    `);
    await queryRunner.query(`
      ALTER TABLE "questionnaire_profile_proposals"
      ADD CONSTRAINT "CHK_questionnaire_profile_proposals_status" CHECK (
        "status" IN ('pending', 'accepted', 'rejected')
      )
    `);
  }
}
