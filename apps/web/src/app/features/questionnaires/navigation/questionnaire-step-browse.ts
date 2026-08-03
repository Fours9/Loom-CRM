import type { QuestionnaireSchemaStep } from '@loom/contracts-questionnaires';
import {
  QUESTIONNAIRE_INTRO_STEP,
  QUESTIONNAIRE_REVIEW_STEP,
  type QuestionnaireWizardStepKey,
} from './questionnaire-step-keys';
import {
  isQuestionnaireStepBrowsable,
  resolveQuestionnaireNavigationMode,
} from './questionnaire-navigation-mode';
import {
  isSchemaStepReachable,
  resolveQuestionnaireActiveStep,
} from './resolve-active-step';

export type QuestionnaireBrowseContext = {
  editable: boolean;
  schemaSteps: Array<Pick<QuestionnaireSchemaStep, 'key'>>;
  completedStepKeys: ReadonlySet<string> | readonly string[];
};

function completedSet(
  keys: ReadonlySet<string> | readonly string[],
): ReadonlySet<string> {
  return keys instanceof Set ? keys : new Set(keys);
}

export function isKnownQuestionnaireStep(
  stepKey: string,
  schemaSteps: Array<Pick<QuestionnaireSchemaStep, 'key'>>,
): boolean {
  if (
    stepKey === QUESTIONNAIRE_INTRO_STEP ||
    stepKey === QUESTIONNAIRE_REVIEW_STEP
  ) {
    return true;
  }
  return schemaSteps.some((s) => s.key === stepKey);
}

function isLinearReachable(
  stepKey: string,
  ctx: QuestionnaireBrowseContext,
): boolean {
  const schemaSteps = ctx.schemaSteps;
  const completed = completedSet(ctx.completedStepKeys);
  if (stepKey === QUESTIONNAIRE_INTRO_STEP) return true;
  if (stepKey === QUESTIONNAIRE_REVIEW_STEP) {
    return (
      schemaSteps.length === 0 ||
      schemaSteps.every((s) => completed.has(s.key))
    );
  }
  return isSchemaStepReachable(stepKey, schemaSteps, completed);
}

/** Whether the step may be opened under current edit/read-only mode. */
export function canBrowseQuestionnaireStep(
  stepKey: string,
  ctx: QuestionnaireBrowseContext,
): boolean {
  if (!isKnownQuestionnaireStep(stepKey, ctx.schemaSteps)) return false;
  const mode = resolveQuestionnaireNavigationMode({ editable: ctx.editable });
  return isQuestionnaireStepBrowsable({
    mode,
    linearReachable: isLinearReachable(stepKey, ctx),
  });
}

/**
 * Resolves a requested step to a browsable active step.
 * free_read_only: honor known requested keys; unknown falls back to linear.
 * linear_edit: use linear gating (same as resolveQuestionnaireActiveStep).
 */
export function resolveBrowsableQuestionnaireStep(input: {
  requestedStepKey: string | null | undefined;
  editable: boolean;
  schemaSteps: Array<Pick<QuestionnaireSchemaStep, 'key'>>;
  completedStepKeys: ReadonlySet<string> | readonly string[];
}): QuestionnaireWizardStepKey {
  const ctx: QuestionnaireBrowseContext = {
    editable: input.editable,
    schemaSteps: input.schemaSteps,
    completedStepKeys: input.completedStepKeys,
  };
  const mode = resolveQuestionnaireNavigationMode({ editable: input.editable });
  const requested = input.requestedStepKey?.trim() || null;

  if (mode === 'free_read_only') {
    if (requested && isKnownQuestionnaireStep(requested, ctx.schemaSteps)) {
      return requested;
    }
    return resolveQuestionnaireActiveStep({
      requestedStepKey: requested,
      schemaSteps: ctx.schemaSteps,
      completedStepKeys: ctx.completedStepKeys,
    });
  }

  return resolveQuestionnaireActiveStep({
    requestedStepKey: requested,
    schemaSteps: ctx.schemaSteps,
    completedStepKeys: ctx.completedStepKeys,
  });
}
