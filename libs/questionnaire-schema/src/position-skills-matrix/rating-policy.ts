import { SKILL_LEVEL_MAX, SKILL_LEVEL_MIN } from '@loom/position-skill-catalog';
import { InvalidPositionSkillsMatrix } from './errors';

export type MatrixRatingPolicy = {
  kind: 'range' | 'percent';
  min: number;
  max: number;
  unit: '%' | null;
};

const LEGACY_POLICY: MatrixRatingPolicy = {
  kind: 'range',
  min: SKILL_LEVEL_MIN,
  max: SKILL_LEVEL_MAX,
  unit: null,
};

/**
 * Resolve per-skill rating bounds from questionnaire context version.
 * v1 / missing → fixed 0..5 (ignore skill scale).
 * v2 → skill.scaleKind/min/max when present; else 0..5 for incomplete data.
 */
export function resolveMatrixRatingPolicy(
  contextVersion: 1 | 2 | null | undefined,
  skill?: {
    scaleKind?: 'range' | 'percent';
    scaleMin?: number;
    scaleMax?: number;
  } | null,
): MatrixRatingPolicy {
  if (contextVersion == null || contextVersion === 1) {
    return { ...LEGACY_POLICY };
  }

  const kind = skill?.scaleKind;
  const min = skill?.scaleMin;
  const max = skill?.scaleMax;
  if (
    (kind === 'range' || kind === 'percent') &&
    typeof min === 'number' &&
    Number.isInteger(min) &&
    typeof max === 'number' &&
    Number.isInteger(max)
  ) {
    return {
      kind,
      min,
      max,
      unit: kind === 'percent' ? '%' : null,
    };
  }

  return { ...LEGACY_POLICY };
}

/** Submit-time check that a rated level sits within policy bounds (inclusive). */
export function validateRatingLevelAgainstPolicy(
  level: number,
  policy: Pick<MatrixRatingPolicy, 'min' | 'max'>,
  label = 'rating.level',
): void {
  if (!Number.isInteger(level) || level < policy.min || level > policy.max) {
    throw new InvalidPositionSkillsMatrix(
      `${label} must be ${policy.min}..${policy.max}`,
    );
  }
}
