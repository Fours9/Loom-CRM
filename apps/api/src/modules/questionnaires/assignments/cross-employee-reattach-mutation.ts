import { parseQuestionnaireContext } from '@loom/contracts-questionnaires';
import { applyCanonicalOrganizationAnswers } from '../questionnaire-organization-selection';
import {
  reconcileSkillsMatrixForNewContext,
  SKILLS_MATRIX_ANSWER_KEY,
} from './reconcile-skills-matrix-for-new-context';

/**
 * Result of different-employee reattach draft+context rewrite (ADR 0010).
 * Side effects (persist, revision bump) stay in QuestionnaireAssignmentService.attach TX.
 */
export type CrossEmployeeReattachMutation = {
  nextContext: Record<string, unknown>;
  nextAnswers: Record<string, unknown>;
  removedStaleSkillCodes: string[];
  resetLifecycle: true;
  bumpRevision: true;
};

/**
 * Pure policy: portable answers preserved; context-owned org allowlist overwritten;
 * skills.matrix reconciled against target context skills.
 */
export function resolveCrossEmployeeReattachMutation(input: {
  answersJson: Record<string, unknown> | null | undefined;
  nextContext: Record<string, unknown>;
}): CrossEmployeeReattachMutation {
  const nextAnswers: Record<string, unknown> = {
    ...(input.answersJson ?? {}),
  };
  const parsed = parseQuestionnaireContext(input.nextContext);

  if (parsed.ok) {
    applyCanonicalOrganizationAnswers(
      nextAnswers,
      parsed.context.positionCatalog,
    );
  }

  const targetCodes = new Set(
    parsed.ok
      ? parsed.context.positionCatalog.skills.map((s) => s.code).filter(Boolean)
      : [],
  );
  const hadMatrix = nextAnswers[SKILLS_MATRIX_ANSWER_KEY] != null;
  const reconciled = reconcileSkillsMatrixForNewContext({
    matrix: nextAnswers[SKILLS_MATRIX_ANSWER_KEY],
    targetContextSkills: targetCodes,
  });
  if (reconciled.matrix !== undefined) {
    nextAnswers[SKILLS_MATRIX_ANSWER_KEY] = reconciled.matrix;
  } else if (hadMatrix) {
    delete nextAnswers[SKILLS_MATRIX_ANSWER_KEY];
  }

  return {
    nextContext: input.nextContext,
    nextAnswers,
    removedStaleSkillCodes: reconciled.removedStaleSkillCodes,
    resetLifecycle: true,
    bumpRevision: true,
  };
}
