import type {
  QuestionnaireSchemaField,
  QuestionnaireSchemaJson,
  QuestionnaireSchemaStep,
} from '@loom/contracts-questionnaires';
import {
  completionPercentVisible,
  isQuestionnaireFieldVisible,
  areStepVisibleRequiredValid,
  listInactiveOwnAnswers,
} from '@loom/questionnaire-schema';
import {
  collectStepIssues,
  isRequiredFieldValid,
  validateFieldValue,
} from '../validation/questionnaire-validation';
import type { FieldValidationIssue } from '../validation/questionnaire-validation';
import {
  resolveQuestionnaireFieldDisplay,
  reviewSourceLabel,
} from '../display/questionnaire-display-value';
import { fieldsByKey } from '@loom/questionnaire-schema';
import {
  emptyEmployeeContactsBundle,
  normalizeEmployeeContactsBundle,
  formatContactsBundleReviewSummary,
} from '@loom/employee-contacts';
import {
  formatPositionSkillsMatrixReviewSummary,
  parsePositionSkillsMatrixStrict,
} from '@loom/questionnaire-schema';
import { skillDefinitionByCode } from '@loom/position-skill-catalog';

export type QuestionnaireStepUiState =
  | 'not_started'
  | 'incomplete'
  | 'complete'
  | 'warning'
  | 'current';

export type QuestionnaireProgress = {
  completedRequiredSteps: number;
  totalSchemaSteps: number;
  /** 0–100 — answered visible / visible (shared with BE) */
  percent: number;
};

export function computeQuestionnaireProgress(
  schemaSteps: QuestionnaireSchemaStep[],
  answers: Record<string, unknown>,
  _profileMirror: Record<string, unknown>,
): QuestionnaireProgress {
  const schema: QuestionnaireSchemaJson = {
    code: 'runtime',
    version: 1,
    title: '',
    steps: schemaSteps,
  };
  const percent = completionPercentVisible(schema, answers);
  let completedRequiredSteps = 0;
  for (const step of schemaSteps) {
    if (
      areStepVisibleRequiredValid(step, answers, (f, v) =>
        isRequiredFieldValid(f, v),
      )
    ) {
      completedRequiredSteps += 1;
    }
  }
  return {
    completedRequiredSteps,
    totalSchemaSteps: schemaSteps.length,
    percent,
  };
}

export function completedSchemaStepKeys(
  schemaSteps: QuestionnaireSchemaStep[],
  answers: Record<string, unknown>,
  _profileMirror: Record<string, unknown>,
): Set<string> {
  const keys = new Set<string>();
  for (const step of schemaSteps) {
    if (
      areStepVisibleRequiredValid(step, answers, (f, v) =>
        isRequiredFieldValid(f, v),
      )
    ) {
      keys.add(step.key);
    }
  }
  return keys;
}

export function visibleFieldsForStep(
  step: QuestionnaireSchemaStep,
  answers: Record<string, unknown>,
): QuestionnaireSchemaField[] {
  return (step.fields ?? []).filter((f) =>
    isQuestionnaireFieldVisible(f, answers),
  );
}

export function schemaStepHasAnswers(
  step: QuestionnaireSchemaStep,
  answers: Record<string, unknown>,
): boolean {
  return visibleFieldsForStep(step, answers).some((f) =>
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
  const complete = areStepVisibleRequiredValid(
    step,
    input.answers,
    (f, v) => isRequiredFieldValid(f, v),
  );
  if (complete) {
    const issues = collectVisibleStepIssues(
      step,
      input.answers,
      input.profileMirror,
      input.schemaSteps,
    );
    if (issues.some((i: FieldValidationIssue) => i.severity === 'warning')) {
      return 'warning';
    }
    return 'complete';
  }
  if (schemaStepHasAnswers(step, input.answers)) return 'incomplete';
  return 'not_started';
}

export function collectVisibleStepIssues(
  step: QuestionnaireSchemaStep,
  answers: Record<string, unknown>,
  profileMirror: Record<string, unknown>,
  allSteps: QuestionnaireSchemaStep[],
): FieldValidationIssue[] {
  const byKey = fieldsByKey({
    code: 'x',
    version: 1,
    title: '',
    steps: allSteps,
  });
  const issues: FieldValidationIssue[] = [];
  for (const field of visibleFieldsForStep(step, answers)) {
    const display = resolveQuestionnaireFieldDisplay(field, {
      answers,
      profileMirror,
      fieldsByKey: byKey,
    });
    const err = validateFieldValue(field, display.value);
    if (err) issues.push(err);
  }
  return issues;
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
  allSteps: QuestionnaireSchemaStep[],
  options?: {
    skillLabelByCode?: (code: string) => string;
  },
): Array<{
  fieldKey: string;
  label: string;
  display: string;
  sourceLabel: string | null;
  inactive: boolean;
}> {
  const byKey = fieldsByKey({
    code: 'x',
    version: 1,
    title: '',
    steps: allSteps,
  });
  const schema = {
    code: 'x',
    version: 1,
    title: '',
    steps: allSteps,
  };
  const inactive = new Set(listInactiveOwnAnswers(schema, answers));

  const rows: Array<{
    fieldKey: string;
    label: string;
    display: string;
    sourceLabel: string | null;
    inactive: boolean;
  }> = [];

  for (const field of step.fields ?? []) {
    const visible = isQuestionnaireFieldVisible(field, answers);
    const hasOwn = Object.prototype.hasOwnProperty.call(answers, field.key);
    if (!visible && !hasOwn) continue;

    const resolved = resolveQuestionnaireFieldDisplay(field, {
      answers,
      profileMirror,
      fieldsByKey: byKey,
    });
    rows.push({
      fieldKey: field.key,
      label: field.label,
      display: formatReviewDisplay(field, resolved.value, options?.skillLabelByCode),
      sourceLabel: visible ? reviewSourceLabel(resolved.source) : null,
      inactive: !visible && hasOwn,
    });
  }
  return rows;
}

function formatReviewDisplay(
  field: QuestionnaireSchemaField,
  value: unknown,
  skillLabelByCode?: (code: string) => string,
): string {
  if (field.valueType === 'contacts_bundle') {
    try {
      return formatContactsBundleReviewSummary(
        normalizeEmployeeContactsBundle(value ?? emptyEmployeeContactsBundle()),
      );
    } catch {
      return '—';
    }
  }
  if (field.valueType === 'position_skills_matrix') {
    try {
      const matrix = parsePositionSkillsMatrixStrict(value);
      return formatPositionSkillsMatrixReviewSummary(
        matrix,
        (code) =>
          skillLabelByCode?.(code) ??
          skillDefinitionByCode(code)?.labelUa ??
          code,
      );
    } catch {
      return '—';
    }
  }
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

// re-export for callers that still import collectStepIssues pattern
export { collectStepIssues };
