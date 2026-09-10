import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Collapse legacy post-submit statuses onto canonical `closed`.
 * Manual-close rows without submissions become terminal closed (revision-ineligible).
 */
export class QuestionnaireSubmitEqualsClosed1730000039000
  implements MigrationInterface
{
  name = 'QuestionnaireSubmitEqualsClosed1730000039000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const legacyTotal = await queryRunner.query(`
      SELECT COUNT(*)::int AS c
      FROM "questionnaire_assignments"
      WHERE "status" IN ('submitted', 'reviewed')
    `);
    const legacyCount = Number(legacyTotal[0]?.c ?? 0);

    const anomalyRows = await queryRunner.query(`
      SELECT COUNT(*)::int AS c
      FROM "questionnaire_assignments" qa
      WHERE qa."status" IN ('submitted', 'reviewed')
        AND NOT EXISTS (
          SELECT 1
          FROM "questionnaire_responses" qr
          INNER JOIN "questionnaire_submissions" qs
            ON qs."response_id" = qr."id"
          WHERE qr."assignment_id" = qa."id"
        )
    `);
    const anomalyCount = Number(anomalyRows[0]?.c ?? 0);

    // eslint-disable-next-line no-console
    console.info(
      `[QuestionnaireSubmitEqualsClosed] legacy submitted|reviewed=${legacyCount}; without submission (integrity anomalies)=${anomalyCount}`,
    );

    await queryRunner.query(`
      UPDATE "questionnaire_assignments"
      SET "status" = 'closed'
      WHERE "status" IN ('submitted', 'reviewed')
    `);

    const remaining = await queryRunner.query(`
      SELECT COUNT(*)::int AS c
      FROM "questionnaire_assignments"
      WHERE "status" IN ('submitted', 'reviewed')
    `);
    const remainingCount = Number(remaining[0]?.c ?? 0);
    if (remainingCount !== 0) {
      throw new Error(
        `QuestionnaireSubmitEqualsClosed post-assert failed: ${remainingCount} submitted|reviewed rows remain`,
      );
    }
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    throw new Error(
      'QuestionnaireSubmitEqualsClosed1730000039000 is irreversible (submitted|reviewed collapsed to closed)',
    );
  }
}
