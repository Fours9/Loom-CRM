import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * CASCADE for hard-delete is enforced by FK definitions in the questionnaires migration.
 * Live wipe against PostgreSQL: questionnaire-assignment-delete.cascade.integration.spec.ts
 */
describe('Questionnaire assignment hard-delete CASCADE contract', () => {
  const migration = readFileSync(
    join(
      __dirname,
      '../../platform/database/migrations/1730000011000-QuestionnairesModule.ts',
    ),
    'utf8',
  );

  it('defines assignment → response → submission → proposal ON DELETE CASCADE', () => {
    expect(migration).toMatch(
      /FK_questionnaire_responses_assignment[\s\S]*?ON DELETE CASCADE/,
    );
    expect(migration).toMatch(
      /FK_questionnaire_submissions_response[\s\S]*?ON DELETE CASCADE/,
    );
    expect(migration).toMatch(
      /FK_questionnaire_profile_proposals_submission[\s\S]*?ON DELETE CASCADE/,
    );
  });
});
