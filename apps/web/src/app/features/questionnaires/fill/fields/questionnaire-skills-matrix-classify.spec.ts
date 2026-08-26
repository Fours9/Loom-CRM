import { classifyManagingMatrixSkills } from './questionnaire-skills-matrix-classify';

describe('classifyManagingMatrixSkills', () => {
  it('always keeps position_requirement in profile even if also desired', () => {
    const result = classifyManagingMatrixSkills({
      frozenSkills: [
        { code: 'sewing', source: 'position_requirement' },
        { code: 'excel', source: 'questionnaire_extra' },
      ],
      desiredExtraCodes: ['sewing', 'excel', 'pending'],
    });
    expect(result.profileCodes).toEqual(['sewing']);
    expect(result.extraCodes).toEqual(['excel', 'pending']);
  });

  it('adds pending desired only when not in frozen/profile set', () => {
    const result = classifyManagingMatrixSkills({
      frozenSkills: [{ code: 'sewing', source: 'position_requirement' }],
      desiredExtraCodes: ['sewing', 'new-extra'],
    });
    expect(result.profileCodes).toEqual(['sewing']);
    expect(result.extraCodes).toEqual(['new-extra']);
  });
});
