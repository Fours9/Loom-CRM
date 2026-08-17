import {
  SKILL_LEVEL_MAX,
  SKILL_LEVEL_MIN,
  MAX_POSITION_SKILLS,
  isSkillCode,
  isSkillIdentityCode,
} from '@loom/position-skill-catalog';
import { InvalidPositionSkillsMatrix } from './errors';

export const POSITION_SKILLS_MATRIX_LIMITS = {
  maxRatings: MAX_POSITION_SKILLS,
  maxCustom: 20,
  nameMaxLength: 120,
  commentMaxLength: 500,
} as const;

export type PositionSkillRating = {
  skillCode: string;
  level: number | null;
  comment: string | null;
};

export type PositionSkillCustom = {
  name: string;
  level: number | null;
  comment: string | null;
};

export type PositionSkillsMatrixAnswer = {
  ratings: PositionSkillRating[];
  custom: PositionSkillCustom[];
};

const RATING_KEYS = new Set(['skillCode', 'level', 'comment']);
const CUSTOM_KEYS = new Set(['name', 'level', 'comment']);
const ROOT_KEYS = new Set(['ratings', 'custom']);

function assertKnownKeys(
  row: Record<string, unknown>,
  allowed: Set<string>,
  label: string,
): void {
  for (const key of Object.keys(row)) {
    if (!allowed.has(key)) {
      throw new InvalidPositionSkillsMatrix(
        `${label}: unknown property "${key}"`,
      );
    }
  }
}

function parseLevel(raw: unknown, label: string): number | null {
  if (raw === null || raw === undefined || raw === '') return null;
  if (typeof raw !== 'number' || !Number.isInteger(raw)) {
    throw new InvalidPositionSkillsMatrix(`${label}: level must be an integer`);
  }
  if (raw < SKILL_LEVEL_MIN || raw > SKILL_LEVEL_MAX) {
    throw new InvalidPositionSkillsMatrix(
      `${label}: level must be ${SKILL_LEVEL_MIN}..${SKILL_LEVEL_MAX}`,
    );
  }
  return raw;
}

function parseComment(raw: unknown, label: string): string | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'string') {
    throw new InvalidPositionSkillsMatrix(`${label}: comment must be a string`);
  }
  const trimmed = raw.trim();
  if (trimmed.length > POSITION_SKILLS_MATRIX_LIMITS.commentMaxLength) {
    throw new InvalidPositionSkillsMatrix(
      `${label}: comment exceeds max length`,
    );
  }
  return trimmed.length ? trimmed : null;
}

/**
 * Strict structural parse for PATCH draft (autosave-safe).
 * Unknown properties → reject. Incomplete rows allowed (null level / empty name).
 */
export function parsePositionSkillsMatrixStrict(
  input: unknown,
): PositionSkillsMatrixAnswer {
  if (input === null || input === undefined) {
    return emptyPositionSkillsMatrix();
  }
  if (typeof input !== 'object' || Array.isArray(input)) {
    throw new InvalidPositionSkillsMatrix('Invalid skills matrix shape');
  }
  const src = input as Record<string, unknown>;
  assertKnownKeys(src, ROOT_KEYS, 'skills.matrix');

  if (src['ratings'] !== undefined && !Array.isArray(src['ratings'])) {
    throw new InvalidPositionSkillsMatrix('ratings must be an array');
  }
  if (src['custom'] !== undefined && !Array.isArray(src['custom'])) {
    throw new InvalidPositionSkillsMatrix('custom must be an array');
  }

  const ratingsRaw = Array.isArray(src['ratings']) ? src['ratings'] : [];
  const customRaw = Array.isArray(src['custom']) ? src['custom'] : [];

  if (ratingsRaw.length > POSITION_SKILLS_MATRIX_LIMITS.maxRatings) {
    throw new InvalidPositionSkillsMatrix('too many ratings');
  }
  if (customRaw.length > POSITION_SKILLS_MATRIX_LIMITS.maxCustom) {
    throw new InvalidPositionSkillsMatrix('too many custom skills');
  }

  const ratings: PositionSkillRating[] = [];
  for (const item of ratingsRaw) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new InvalidPositionSkillsMatrix('Invalid rating row');
    }
    const row = item as Record<string, unknown>;
    assertKnownKeys(row, RATING_KEYS, 'rating');
    if (row['skillCode'] !== undefined && typeof row['skillCode'] !== 'string') {
      throw new InvalidPositionSkillsMatrix('rating.skillCode must be a string');
    }
    const skillCode =
      row['skillCode'] === undefined ? '' : String(row['skillCode']);
    if (skillCode && !isSkillIdentityCode(skillCode)) {
      throw new InvalidPositionSkillsMatrix(
        `rating.skillCode "${skillCode}" is not a valid skill identity`,
      );
    }
    ratings.push({
      skillCode,
      level: parseLevel(row['level'], 'rating'),
      comment: parseComment(row['comment'], 'rating'),
    });
  }

  const custom: PositionSkillCustom[] = [];
  for (const item of customRaw) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new InvalidPositionSkillsMatrix('Invalid custom skill row');
    }
    const row = item as Record<string, unknown>;
    assertKnownKeys(row, CUSTOM_KEYS, 'custom');
    if (row['name'] !== undefined && typeof row['name'] !== 'string') {
      throw new InvalidPositionSkillsMatrix('custom.name must be a string');
    }
    const name = row['name'] === undefined ? '' : String(row['name']);
    if (name.length > POSITION_SKILLS_MATRIX_LIMITS.nameMaxLength) {
      throw new InvalidPositionSkillsMatrix('custom.name exceeds max length');
    }
    custom.push({
      name,
      level: parseLevel(row['level'], 'custom'),
      comment: parseComment(row['comment'], 'custom'),
    });
  }

  return canonicalizePositionSkillsMatrix({ ratings, custom });
}

/** Drop empty custom rows; stable order by skillCode then custom name. */
export function canonicalizePositionSkillsMatrix(
  matrix: PositionSkillsMatrixAnswer,
): PositionSkillsMatrixAnswer {
  const ratings = [...matrix.ratings]
    .filter((r) => r.skillCode.length > 0)
    .sort((a, b) => a.skillCode.localeCompare(b.skillCode));
  const custom = matrix.custom
    .map((c) => ({
      name: c.name.trim(),
      level: c.level,
      comment: c.comment,
    }))
    .filter((c) => c.name.length > 0 || c.level != null || (c.comment?.length ?? 0) > 0)
    .filter((c) => {
      // Fully empty after trim → drop
      if (!c.name && c.level == null && !c.comment) return false;
      return true;
    });

  return { ratings, custom };
}

export function emptyPositionSkillsMatrix(): PositionSkillsMatrixAnswer {
  return { ratings: [], custom: [] };
}

export function isPositionSkillsMatrixMeaningful(
  matrix: PositionSkillsMatrixAnswer,
): boolean {
  return (
    matrix.ratings.some((r) => r.skillCode && r.level != null) ||
    matrix.custom.some((c) => c.name.trim().length > 0 && c.level != null)
  );
}

/**
 * Semantic validation for SUBMIT.
 * @param allowedSkillCodes when set (frozen context), ratings must be ⊆ this set
 */
export function validatePositionSkillsMatrixForSubmit(
  matrix: PositionSkillsMatrixAnswer,
  allowedSkillCodes?: ReadonlySet<string> | readonly string[],
): void {
  const allowed =
    allowedSkillCodes == null
      ? null
      : allowedSkillCodes instanceof Set
        ? allowedSkillCodes
        : new Set(allowedSkillCodes);

  const seen = new Set<string>();
  for (const r of matrix.ratings) {
    if (!r.skillCode || !isSkillIdentityCode(r.skillCode)) {
      throw new InvalidPositionSkillsMatrix(
        `rating.skillCode required and must be a valid skill identity`,
      );
    }
    if (seen.has(r.skillCode)) {
      throw new InvalidPositionSkillsMatrix(
        `duplicate skillCode "${r.skillCode}"`,
      );
    }
    seen.add(r.skillCode);
    if (allowed == null) {
      if (!isSkillCode(r.skillCode)) {
        throw new InvalidPositionSkillsMatrix(
          `rating.skillCode required and must be in registry`,
        );
      }
    } else if (!allowed.has(r.skillCode)) {
      throw new InvalidPositionSkillsMatrix(
        `skillCode "${r.skillCode}" not in frozen position context`,
      );
    }
    if (r.level == null) {
      throw new InvalidPositionSkillsMatrix(
        `rating.level required for "${r.skillCode}"`,
      );
    }
  }

  for (const c of matrix.custom) {
    const name = c.name.trim();
    if (!name) {
      throw new InvalidPositionSkillsMatrix('custom.name required');
    }
    if (c.level == null) {
      throw new InvalidPositionSkillsMatrix(
        `custom.level required for "${name}"`,
      );
    }
  }
}

export function formatPositionSkillsMatrixReviewSummary(
  matrix: PositionSkillsMatrixAnswer,
  labelByCode: (code: string) => string,
): string {
  const parts: string[] = [];
  for (const r of matrix.ratings) {
    if (r.level == null) continue;
    parts.push(`${labelByCode(r.skillCode)}: ${r.level}`);
  }
  for (const c of matrix.custom) {
    if (!c.name.trim() || c.level == null) continue;
    parts.push(`${c.name.trim()}: ${c.level}`);
  }
  return parts.length ? parts.join('; ') : '—';
}
