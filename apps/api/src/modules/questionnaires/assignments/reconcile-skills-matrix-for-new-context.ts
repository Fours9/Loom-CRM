import {
  InvalidPositionSkillsMatrix,
  parsePositionSkillsMatrixStrict,
  pruneUnratedMatrixRatings,
  type PositionSkillsMatrixAnswer,
} from '@loom/questionnaire-schema';
import { staleRatingCodes } from '../questionnaire-position-context-sync.policy';

const MATRIX_KEY = 'skills.matrix';

/**
 * Shared skills.matrix reconcile for syncLocked + cross-employee reattach.
 * Keeps ratings whose code is in target context; drops stale codes; preserves custom[].
 */
export function reconcileSkillsMatrixForNewContext(input: {
  matrix: unknown;
  targetContextSkills: ReadonlySet<string>;
}): {
  matrix: PositionSkillsMatrixAnswer | undefined;
  removedStaleSkillCodes: string[];
} {
  if (input.matrix == null) {
    return { matrix: undefined, removedStaleSkillCodes: [] };
  }

  let parsed: PositionSkillsMatrixAnswer;
  try {
    parsed = parsePositionSkillsMatrixStrict(input.matrix);
  } catch (err) {
    if (err instanceof InvalidPositionSkillsMatrix) {
      return { matrix: undefined, removedStaleSkillCodes: [] };
    }
    throw err;
  }

  const draftCodes = parsed.ratings.map((r) => r.skillCode).filter(Boolean);
  const stale = staleRatingCodes(draftCodes, input.targetContextSkills);
  let next: PositionSkillsMatrixAnswer = parsed;
  if (stale.size > 0) {
    next = {
      ...parsed,
      ratings: parsed.ratings.filter((r) => !stale.has(r.skillCode)),
      custom: parsed.custom,
    };
  }
  next = pruneUnratedMatrixRatings(next);
  return {
    matrix: next,
    removedStaleSkillCodes: [...stale],
  };
}

export { MATRIX_KEY as SKILLS_MATRIX_ANSWER_KEY };
