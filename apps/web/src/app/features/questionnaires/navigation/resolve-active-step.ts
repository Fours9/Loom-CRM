import type { QuestionnaireSchemaStep } from '@loom/contracts-questionnaires';
import {
  QUESTIONNAIRE_INTRO_STEP,
  QUESTIONNAIRE_REVIEW_STEP,
  type QuestionnaireWizardStepKey,
} from './questionnaire-step-keys';

export type ResolveQuestionnaireActiveStepInput = {
  requestedStepKey: string | null | undefined;
  schemaSteps: Array<Pick<QuestionnaireSchemaStep, 'key'>>;
  /** Schema step keys whose required fields are all valid. */
  completedStepKeys: ReadonlySet<string> | readonly string[];
};

/**
 * Linear MVP gating: Intro → schema steps → Review.
 * Future steps are unreachable until prior required fields are complete.
 */
export function resolveQuestionnaireActiveStep(
  input: ResolveQuestionnaireActiveStepInput,
): QuestionnaireWizardStepKey {
  const schemaKeys = input.schemaSteps.map((s) => s.key);
  const completed = toSet(input.completedStepKeys);
  const firstIncomplete = firstIncompleteSchemaStep(schemaKeys, completed);
  const allComplete =
    schemaKeys.length > 0 && schemaKeys.every((k) => completed.has(k));

  const requested = input.requestedStepKey?.trim() || null;

  if (!requested) {
    if (schemaKeys.length === 0) return QUESTIONNAIRE_INTRO_STEP;
    if (allComplete) return QUESTIONNAIRE_REVIEW_STEP;
    if (completed.size === 0) return QUESTIONNAIRE_INTRO_STEP;
    return firstIncomplete ?? QUESTIONNAIRE_INTRO_STEP;
  }

  if (requested === QUESTIONNAIRE_INTRO_STEP) {
    return QUESTIONNAIRE_INTRO_STEP;
  }

  if (requested === QUESTIONNAIRE_REVIEW_STEP) {
    if (schemaKeys.length === 0 || allComplete) {
      return QUESTIONNAIRE_REVIEW_STEP;
    }
    return firstIncomplete ?? QUESTIONNAIRE_INTRO_STEP;
  }

  const idx = schemaKeys.indexOf(requested);
  if (idx < 0) {
    return (
      firstIncomplete ??
      (allComplete ? QUESTIONNAIRE_REVIEW_STEP : QUESTIONNAIRE_INTRO_STEP)
    );
  }

  // Reachable if all previous schema steps are complete.
  for (let i = 0; i < idx; i += 1) {
    if (!completed.has(schemaKeys[i]!)) {
      return firstIncomplete ?? schemaKeys[0]!;
    }
  }

  return requested;
}

export function isSchemaStepReachable(
  stepKey: string,
  schemaSteps: Array<Pick<QuestionnaireSchemaStep, 'key'>>,
  completedStepKeys: ReadonlySet<string> | readonly string[],
): boolean {
  const schemaKeys = schemaSteps.map((s) => s.key);
  const completed = toSet(completedStepKeys);
  const idx = schemaKeys.indexOf(stepKey);
  if (idx < 0) return false;
  for (let i = 0; i < idx; i += 1) {
    if (!completed.has(schemaKeys[i]!)) return false;
  }
  return true;
}

function firstIncompleteSchemaStep(
  schemaKeys: string[],
  completed: ReadonlySet<string>,
): string | null {
  for (const key of schemaKeys) {
    if (!completed.has(key)) return key;
  }
  return null;
}

function toSet(
  keys: ReadonlySet<string> | readonly string[],
): ReadonlySet<string> {
  return keys instanceof Set ? keys : new Set(keys);
}
