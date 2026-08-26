import { decideSkillMatrixUpsert } from './employee-skill-matrix-upsert.policy';

describe('decideSkillMatrixUpsert', () => {
  it('updates when assessment already exists (profile or extra)', () => {
    expect(
      decideSkillMatrixUpsert({
        hasConfirmedAssessment: true,
        isCurrentRequirement: false,
      }),
    ).toEqual({ action: 'update_existing' });
  });

  it('inserts when rating a current position requirement for the first time', () => {
    expect(
      decideSkillMatrixUpsert({
        hasConfirmedAssessment: false,
        isCurrentRequirement: true,
      }),
    ).toEqual({ action: 'insert_requirement' });
  });

  it('rejects creating a non-requirement skill via upsert', () => {
    expect(
      decideSkillMatrixUpsert({
        hasConfirmedAssessment: false,
        isCurrentRequirement: false,
      }),
    ).toEqual({
      action: 'reject_not_on_matrix',
      reason: 'not_requirement_and_no_assessment',
    });
  });
});
