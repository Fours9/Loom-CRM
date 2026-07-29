import type {
  QuestionnaireSchemaField,
  QuestionnaireSchemaStep,
} from '@loom/contracts-questionnaires';
import {
  areStepRequiredFieldsValid,
  collectStepIssues,
  displayFieldValue,
} from '../validation/questionnaire-validation';
import type { FieldValidationIssue } from '../validation/questionnaire-validation';

export type QuestionnaireStepUiState =
  | 'not_started'
  | 'incomplete'
  | 'complete'
  | 'warning'
  | 'current';

export type QuestionnaireProgress = {
  completedRequiredSteps: number;
  totalSchemaSteps: number;
  /** 0–100 */
  percent: number;
};

/**
 * Progress = (# schema steps with all required valid) / (# schema steps).
 * Intro / Review are excluded.
 */
export function computeQuestionnaireProgress(
  schemaSteps: QuestionnaireSchemaStep[],
  answers: Record<string, unknown>,
  profileMirror: Record<string, unknown>,
): QuestionnaireProgress {
  const totalSchemaSteps = schemaSteps.length;
  if (totalSchemaSteps === 0) {
    return { completedRequiredSteps: 0, totalSchemaSteps: 0, percent: 0 };
  }
  let completedRequiredSteps = 0;
  for (const step of schemaSteps) {
    if (areStepRequiredFieldsValid(step.fields, answers, profileMirror)) {
      completedRequiredSteps += 1;
    }
  }
  return {
    completedRequiredSteps,
    totalSchemaSteps,
    percent: Math.round((completedRequiredSteps / totalSchemaSteps) * 100),
  };
}

export function completedSchemaStepKeys(
  schemaSteps: QuestionnaireSchemaStep[],
  answers: Record<string, unknown>,
  profileMirror: Record<string, unknown>,
): Set<string> {
  const keys = new Set<string>();
  for (const step of schemaSteps) {
    if (areStepRequiredFieldsValid(step.fields, answers, profileMirror)) {
      keys.add(step.key);
    }
  }
  return keys;
}

export function schemaStepHasAnswers(
  step: QuestionnaireSchemaStep,
  answers: Record<string, unknown>,
): boolean {
  return step.fields.some((f) =>
    Object.prototype.hasOwnProperty.call(answers, f.key),
  );
}

export function resolveStepUiState(input: {
  stepKey: string;
  currentStepKey: string;
  schemaSteps: QuestionnaireSchemaStep[];
  answers: Record<string, unknown>;
  profileMirror: Record<string, unknown>;
}): QuestionnaireStepUiState {
  if (input.stepKey === input.currentStepKey) return 'current';
  const step = input.schemaSteps.find((s) => s.key === input.stepKey);
  if (!step) return 'not_started';
  const complete = areStepRequiredFieldsValid(
    step.fields,
    input.answers,
    input.profileMirror,
  );
  if (complete) {
    const issues = collectStepIssues(
      step.fields,
      input.answers,
      input.profileMirror,
    );
    if (issues.some((i: FieldValidationIssue) => i.severity === 'warning')) return 'warning';
    return 'complete';
  }
  if (schemaStepHasAnswers(step, input.answers)) return 'incomplete';
  return 'not_started';
}

export function choiceLabel(
  field: QuestionnaireSchemaField,
  value: unknown,
): string {
  if (field.valueType === 'multi_choice' && Array.isArray(value)) {
    return value
      .map((v) => field.options?.find((o) => o.value === v)?.label ?? String(v))
      .join(', ');
  }
  if (typeof value === 'string') {
    return field.options?.find((o) => o.value === value)?.label ?? value;
  }
  if (typeof value === 'boolean') {
    return value ? 'Так' : 'Ні';
  }
  if (value === null || value === undefined) return '—';
  return String(value);
}

export function reviewRowsForStep(
  step: QuestionnaireSchemaStep,
  answers: Record<string, unknown>,
  profileMirror: Record<string, unknown>,
): Array<{ fieldKey: string; label: string; display: string }> {
  return step.fields.map((field) => {
    const value = displayFieldValue(answers, profileMirror, field);
    return {
      fieldKey: field.key,
      label: field.label,
      display: formatReviewDisplay(field, value),
    };
  });
}

function formatReviewDisplay(
  field: QuestionnaireSchemaField,
  value: unknown,
): string {
  if (field.valueType === 'repeating_group') {
    const rows = Array.isArray(value) ? value : [];
    if (!rows.length) return '—';
    return `${rows.length} запис(ів)`;
  }
  if (
    field.valueType === 'single_choice' ||
    field.valueType === 'multi_choice' ||
    field.valueType === 'boolean'
  ) {
    return choiceLabel(field, value);
  }
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}
