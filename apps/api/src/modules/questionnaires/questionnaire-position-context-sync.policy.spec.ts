import {
  resolveValidatedExtras,
  staleRatingCodes,
  validateDesiredExtraSkillCodes,
} from './questionnaire-position-context-sync.policy';

describe('validateDesiredExtraSkillCodes', () => {
  it('accepts empty array', () => {
    expect(validateDesiredExtraSkillCodes([])).toEqual({
      ok: true,
      codes: [],
    });
  });

  it('rejects non-array', () => {
    expect(validateDesiredExtraSkillCodes(null).ok).toBe(false);
  });

  it('rejects duplicates', () => {
    const result = validateDesiredExtraSkillCodes(['sewing', 'sewing']);
    expect(result.ok).toBe(false);
  });

  it('rejects invalid identity', () => {
    const result = validateDesiredExtraSkillCodes(['Bad_Code']);
    expect(result.ok).toBe(false);
  });
});

describe('resolveValidatedExtras', () => {
  it('drops codes already in requirements', () => {
    const result = resolveValidatedExtras({
      desiredExtraSkillCodes: ['X', 'B1'],
      newRequirementCodes: new Set(['B1']),
    });
    expect(result).toEqual({ ok: true, extraCodes: ['X'] });
  });

  it('rejects when union exceeds MAX_POSITION_SKILLS', () => {
    const req = new Set(
      Array.from({ length: 64 }, (_, i) => `skill_${i.toString(16).padStart(12, '0')}`),
    );
    const result = resolveValidatedExtras({
      desiredExtraSkillCodes: ['sewing'],
      newRequirementCodes: req,
    });
    expect(result.ok).toBe(false);
  });
});

describe('staleRatingCodes', () => {
  it('returns rating codes absent from context', () => {
    const stale = staleRatingCodes(['A', 'B', 'C'], new Set(['A', 'C']));
    expect([...stale].sort()).toEqual(['B']);
  });
});
