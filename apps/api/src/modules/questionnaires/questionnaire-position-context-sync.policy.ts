/**
 * Pure helpers for Managing position-context sync.
 * Extras come from explicit desiredExtraSkillCodes (not null-rating transport).
 */

import { MAX_POSITION_SKILLS, isSkillIdentityCode } from '@loom/position-skill-catalog';

export type DesiredExtrasValidation =
  | { ok: true; codes: string[] }
  | { ok: false; error: string };

/**
 * Fail-closed DTO validation: unique identity codes, length ≤ MAX_POSITION_SKILLS.
 */
export function validateDesiredExtraSkillCodes(
  raw: unknown,
): DesiredExtrasValidation {
  if (!Array.isArray(raw)) {
    return { ok: false, error: 'desiredExtraSkillCodes must be an array' };
  }
  if (raw.length > MAX_POSITION_SKILLS) {
    return {
      ok: false,
      error: `desiredExtraSkillCodes exceeds max ${MAX_POSITION_SKILLS}`,
    };
  }
  const codes: string[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < raw.length; i++) {
    const code = raw[i];
    if (typeof code !== 'string' || !isSkillIdentityCode(code)) {
      return {
        ok: false,
        error: `desiredExtraSkillCodes[${i}] must be a valid skill identity`,
      };
    }
    if (seen.has(code)) {
      return {
        ok: false,
        error: `desiredExtraSkillCodes contains duplicate "${code}"`,
      };
    }
    seen.add(code);
    codes.push(code);
  }
  return { ok: true, codes };
}

/**
 * Drop codes already covered by new position requirements (idempotent UX).
 * Enforce |requirements ∪ extras| ≤ MAX_POSITION_SKILLS.
 */
export function resolveValidatedExtras(input: {
  desiredExtraSkillCodes: readonly string[];
  newRequirementCodes: ReadonlySet<string>;
}):
  | { ok: true; extraCodes: string[] }
  | { ok: false; error: string } {
  const extraCodes = input.desiredExtraSkillCodes.filter(
    (code) => !input.newRequirementCodes.has(code),
  );
  const unionSize = input.newRequirementCodes.size + extraCodes.length;
  if (unionSize > MAX_POSITION_SKILLS) {
    return {
      ok: false,
      error: `Context skills would exceed max ${MAX_POSITION_SKILLS} (requirements ∪ extras)`,
    };
  }
  return { ok: true, extraCodes };
}

/** Rating codes present in draft that are not in the new context skill set. */
export function staleRatingCodes(
  draftRatingCodes: Iterable<string>,
  contextSkillCodes: ReadonlySet<string>,
): Set<string> {
  const stale = new Set<string>();
  for (const code of draftRatingCodes) {
    if (code && !contextSkillCodes.has(code)) stale.add(code);
  }
  return stale;
}
