import {
  parsePositionSkillsMatrixStrict,
  validatePositionSkillsMatrixForSubmit,
  isPositionSkillsMatrixMeaningful,
} from './matrix';
import { InvalidPositionSkillsMatrix } from './errors';

describe('position_skills_matrix', () => {
  it('rejects unknown properties', () => {
    expect(() =>
      parsePositionSkillsMatrixStrict({
        ratings: [{ skillCode: 'sewing', level: 3, typoLevel: 2 }],
        custom: [],
      }),
    ).toThrow(InvalidPositionSkillsMatrix);
  });

  it('allows incomplete draft rows on PATCH parse', () => {
    const m = parsePositionSkillsMatrixStrict({
      ratings: [{ skillCode: 'sewing', level: null }],
      custom: [{ name: '', level: null }],
    });
    expect(m.ratings).toEqual([
      { skillCode: 'sewing', level: null, comment: null },
    ]);
    expect(m.custom).toEqual([]);
  });

  it('submit requires complete ratings and unique codes', () => {
    const m = parsePositionSkillsMatrixStrict({
      ratings: [
        { skillCode: 'sewing', level: 4 },
        { skillCode: 'sewing', level: 2 },
      ],
      custom: [],
    });
    expect(() => validatePositionSkillsMatrixForSubmit(m)).toThrow(/duplicate/);
  });

  it('submit allows custom identity when frozen allowlist includes it', () => {
    const m = parsePositionSkillsMatrixStrict({
      ratings: [{ skillCode: 'skill_abc123def', level: 4 }],
      custom: [],
    });
    expect(() =>
      validatePositionSkillsMatrixForSubmit(m, ['skill_abc123def']),
    ).not.toThrow();
  });

  it('submit rejects custom identity in legacy (no allowlist)', () => {
    const m = parsePositionSkillsMatrixStrict({
      ratings: [{ skillCode: 'skill_abc123def', level: 4 }],
      custom: [],
    });
    expect(() => validatePositionSkillsMatrixForSubmit(m)).toThrow(/registry/);
  });

  it('submit rejects sewing when frozen allowlist is empty', () => {
    const m = parsePositionSkillsMatrixStrict({
      ratings: [{ skillCode: 'sewing', level: 4 }],
      custom: [],
    });
    expect(() => validatePositionSkillsMatrixForSubmit(m, [])).toThrow(
      /frozen/,
    );
  });

  it('meaningful when any rated skill', () => {
    expect(
      isPositionSkillsMatrixMeaningful({
        ratings: [{ skillCode: 'sewing', level: 1, comment: null }],
        custom: [],
      }),
    ).toBe(true);
    expect(
      isPositionSkillsMatrixMeaningful({ ratings: [], custom: [] }),
    ).toBe(false);
  });
});
