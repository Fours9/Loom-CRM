import {
  parsePositionSkillsMatrixStrict,
  validatePositionSkillsMatrixForSubmit,
  isPositionSkillsMatrixMeaningful,
  pruneUnratedMatrixRatings,
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

  it('draft parse accepts levels outside 0..5 within wide envelope', () => {
    const m = parsePositionSkillsMatrixStrict({
      ratings: [{ skillCode: 'sewing', level: 85 }],
      custom: [],
    });
    expect(m.ratings[0]?.level).toBe(85);
  });

  it('draft parse rejects levels outside structural envelope', () => {
    expect(() =>
      parsePositionSkillsMatrixStrict({
        ratings: [{ skillCode: 'sewing', level: 10001 }],
        custom: [],
      }),
    ).toThrow(/-1000\.\.10000/);
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

  it('submit enforces default 0..5 when no levelBoundsByCode', () => {
    const m = parsePositionSkillsMatrixStrict({
      ratings: [{ skillCode: 'sewing', level: 85 }],
      custom: [],
    });
    expect(() => validatePositionSkillsMatrixForSubmit(m)).toThrow(/0\.\.5/);
  });

  it('submit uses levelBoundsByCode for registry ratings; custom stays 0..5', () => {
    const m = parsePositionSkillsMatrixStrict({
      ratings: [{ skillCode: 'sewing', level: 85 }],
      custom: [{ name: 'Extra', level: 3 }],
    });
    const bounds = new Map([['sewing', { min: 0, max: 100 }]]);
    expect(() =>
      validatePositionSkillsMatrixForSubmit(m, undefined, bounds),
    ).not.toThrow();

    const badCustom = parsePositionSkillsMatrixStrict({
      ratings: [{ skillCode: 'sewing', level: 50 }],
      custom: [{ name: 'Extra', level: 50 }],
    });
    expect(() =>
      validatePositionSkillsMatrixForSubmit(badCustom, undefined, bounds),
    ).toThrow(/custom\.level/);
  });

  it('pruneUnratedMatrixRatings drops null levels and empty custom', () => {
    const pruned = pruneUnratedMatrixRatings({
      ratings: [
        { skillCode: 'sewing', level: 3, comment: null },
        { skillCode: 'cutting', level: null, comment: null },
        { skillCode: 'pressing', level: null, comment: 'note' },
      ],
      custom: [
        { name: 'Extra', level: 2, comment: null },
        { name: '', level: null, comment: null },
      ],
    });
    expect(pruned.ratings).toEqual([
      { skillCode: 'sewing', level: 3, comment: null },
    ]);
    expect(pruned.custom).toEqual([
      { name: 'Extra', level: 2, comment: null },
    ]);
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
