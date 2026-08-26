import { classifyEmployeeSkillMatrixBuckets } from './employee-skill-matrix.classify';

describe('classifyEmployeeSkillMatrixBuckets', () => {
  it('puts all PSR rows in profile including optional requirements', () => {
    const result = classifyEmployeeSkillMatrixBuckets({
      requirementSkillIds: ['req-required', 'req-optional'],
      confirmedSkillIds: ['req-required', 'extra-1'],
    });
    expect(result.profileSkillIds).toEqual(['req-required', 'req-optional']);
    expect(result.extraSkillIds).toEqual(['extra-1']);
  });

  it('moves former requirement assessments to extras when position requirements change', () => {
    // Position A had skill-a; position B has skill-b only — skill-a becomes extra.
    const result = classifyEmployeeSkillMatrixBuckets({
      requirementSkillIds: ['skill-b'],
      confirmedSkillIds: ['skill-a', 'skill-b'],
    });
    expect(result.profileSkillIds).toEqual(['skill-b']);
    expect(result.extraSkillIds).toEqual(['skill-a']);
  });

  it('puts all confirmed into extras when there is no current position', () => {
    const result = classifyEmployeeSkillMatrixBuckets({
      requirementSkillIds: [],
      confirmedSkillIds: ['a', 'b'],
    });
    expect(result.profileSkillIds).toEqual([]);
    expect(result.extraSkillIds).toEqual(['a', 'b']);
  });
});
