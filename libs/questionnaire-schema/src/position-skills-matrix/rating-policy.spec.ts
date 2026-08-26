import {
  resolveMatrixRatingPolicy,
  validateRatingLevelAgainstPolicy,
} from './rating-policy';
import { InvalidPositionSkillsMatrix } from './errors';

describe('resolveMatrixRatingPolicy', () => {
  it('returns 0..5 range for null / undefined / v1 and ignores skill scale', () => {
    const skill = {
      scaleKind: 'percent' as const,
      scaleMin: 0,
      scaleMax: 100,
    };
    for (const version of [null, undefined, 1] as const) {
      expect(resolveMatrixRatingPolicy(version, skill)).toEqual({
        kind: 'range',
        min: 0,
        max: 5,
        unit: null,
      });
    }
  });

  it('uses skill scale for context version 2', () => {
    expect(
      resolveMatrixRatingPolicy(2, {
        scaleKind: 'percent',
        scaleMin: 10,
        scaleMax: 90,
      }),
    ).toEqual({
      kind: 'percent',
      min: 10,
      max: 90,
      unit: '%',
    });

    expect(
      resolveMatrixRatingPolicy(2, {
        scaleKind: 'range',
        scaleMin: -2,
        scaleMax: 8,
      }),
    ).toEqual({
      kind: 'range',
      min: -2,
      max: 8,
      unit: null,
    });
  });

  it('falls back to 0..5 when v2 skill scale is incomplete', () => {
    expect(resolveMatrixRatingPolicy(2, null)).toEqual({
      kind: 'range',
      min: 0,
      max: 5,
      unit: null,
    });
    expect(resolveMatrixRatingPolicy(2, { scaleKind: 'percent' })).toEqual({
      kind: 'range',
      min: 0,
      max: 5,
      unit: null,
    });
    expect(
      resolveMatrixRatingPolicy(2, {
        scaleKind: 'range',
        scaleMin: 1,
      }),
    ).toEqual({
      kind: 'range',
      min: 0,
      max: 5,
      unit: null,
    });
  });
});

describe('validateRatingLevelAgainstPolicy', () => {
  it('accepts levels within bounds', () => {
    expect(() =>
      validateRatingLevelAgainstPolicy(50, { min: 0, max: 100 }),
    ).not.toThrow();
  });

  it('rejects levels outside bounds', () => {
    expect(() =>
      validateRatingLevelAgainstPolicy(6, { min: 0, max: 5 }),
    ).toThrow(InvalidPositionSkillsMatrix);
    expect(() =>
      validateRatingLevelAgainstPolicy(6, { min: 0, max: 5 }),
    ).toThrow(/0\.\.5/);
  });
});
