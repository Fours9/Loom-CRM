import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Questionnaire 360 MVP tables (templates, assignments, drafts, immutable
 * submissions, profile proposals). Seed data is applied at API bootstrap.
 */
export class QuestionnairesModule1730000011000 implements MigrationInterface {
  name = 'QuestionnairesModule1730000011000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "questionnaire_templates" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "code" character varying(64) NOT NULL,
        "title" character varying(255) NOT NULL,
        "status" character varying(32) NOT NULL DEFAULT 'draft',
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_questionnaire_templates" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_questionnaire_templates_code" UNIQUE ("code"),
        CONSTRAINT "CHK_questionnaire_templates_status" CHECK (
          "status" IN ('draft', 'published', 'archived')
        )
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "questionnaire_template_versions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "template_id" uuid NOT NULL,
        "version" integer NOT NULL,
        "schema_json" jsonb NOT NULL,
        "published_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_questionnaire_template_versions" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_questionnaire_template_versions_template_version"
          UNIQUE ("template_id", "version"),
        CONSTRAINT "FK_questionnaire_template_versions_template"
          FOREIGN KEY ("template_id") REFERENCES "questionnaire_templates"("id")
          ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_questionnaire_template_versions_template"
      ON "questionnaire_template_versions" ("template_id")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "questionnaire_assignments" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "template_version_id" uuid NOT NULL,
        "employee_id" uuid NOT NULL,
        "assigned_by_user_id" uuid NOT NULL,
        "status" character varying(32) NOT NULL DEFAULT 'assigned',
        "due_at" TIMESTAMPTZ,
        "started_at" TIMESTAMPTZ,
        "submitted_at" TIMESTAMPTZ,
        "reviewed_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_questionnaire_assignments" PRIMARY KEY ("id"),
        CONSTRAINT "FK_questionnaire_assignments_template_version"
          FOREIGN KEY ("template_version_id")
          REFERENCES "questionnaire_template_versions"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_questionnaire_assignments_employee"
          FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_questionnaire_assignments_assigned_by"
          FOREIGN KEY ("assigned_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT,
        CONSTRAINT "CHK_questionnaire_assignments_status" CHECK (
          "status" IN (
            'assigned',
            'in_progress',
            'submitted',
            'changes_requested',
            'reviewed',
            'cancelled'
          )
        )
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_questionnaire_assignments_employee"
      ON "questionnaire_assignments" ("employee_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_questionnaire_assignments_template_version"
      ON "questionnaire_assignments" ("template_version_id")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "questionnaire_responses" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "assignment_id" uuid NOT NULL,
        "answers_json" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "revision" integer NOT NULL DEFAULT 0,
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_questionnaire_responses" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_questionnaire_responses_assignment" UNIQUE ("assignment_id"),
        CONSTRAINT "FK_questionnaire_responses_assignment"
          FOREIGN KEY ("assignment_id") REFERENCES "questionnaire_assignments"("id")
          ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "questionnaire_submissions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "response_id" uuid NOT NULL,
        "submission_number" integer NOT NULL,
        "snapshot_json" jsonb NOT NULL,
        "submitted_by_user_id" uuid NOT NULL,
        "submitted_at" TIMESTAMPTZ NOT NULL,
        "review_status" character varying(32) NOT NULL DEFAULT 'pending',
        "reviewed_by_user_id" uuid,
        "reviewed_at" TIMESTAMPTZ,
        "review_comment" text,
        CONSTRAINT "PK_questionnaire_submissions" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_questionnaire_submissions_response_number"
          UNIQUE ("response_id", "submission_number"),
        CONSTRAINT "FK_questionnaire_submissions_response"
          FOREIGN KEY ("response_id") REFERENCES "questionnaire_responses"("id")
          ON DELETE CASCADE,
        CONSTRAINT "FK_questionnaire_submissions_submitted_by"
          FOREIGN KEY ("submitted_by_user_id") REFERENCES "users"("id")
          ON DELETE RESTRICT,
        CONSTRAINT "FK_questionnaire_submissions_reviewed_by"
          FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id")
          ON DELETE SET NULL,
        CONSTRAINT "CHK_questionnaire_submissions_review_status" CHECK (
          "review_status" IN ('pending', 'changes_requested', 'approved')
        )
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_questionnaire_submissions_response"
      ON "questionnaire_submissions" ("response_id")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "questionnaire_profile_proposals" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "submission_id" uuid NOT NULL,
        "employee_id" uuid NOT NULL,
        "target_section" character varying(64) NOT NULL,
        "proposed_changes" jsonb NOT NULL,
        "status" character varying(32) NOT NULL DEFAULT 'pending',
        "reviewed_by_user_id" uuid,
        "reviewed_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_questionnaire_profile_proposals" PRIMARY KEY ("id"),
        CONSTRAINT "FK_questionnaire_profile_proposals_submission"
          FOREIGN KEY ("submission_id") REFERENCES "questionnaire_submissions"("id")
          ON DELETE CASCADE,
        CONSTRAINT "FK_questionnaire_profile_proposals_employee"
          FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_questionnaire_profile_proposals_reviewed_by"
          FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id")
          ON DELETE SET NULL,
        CONSTRAINT "CHK_questionnaire_profile_proposals_status" CHECK (
          "status" IN ('pending', 'accepted', 'rejected')
        )
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_questionnaire_profile_proposals_submission"
      ON "questionnaire_profile_proposals" ("submission_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_questionnaire_profile_proposals_employee"
      ON "questionnaire_profile_proposals" ("employee_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TABLE IF EXISTS "questionnaire_profile_proposals"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "questionnaire_submissions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "questionnaire_responses"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "questionnaire_assignments"`);
    await queryRunner.query(
      `DROP TABLE IF EXISTS "questionnaire_template_versions"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "questionnaire_templates"`);
  }
}
