import type {
  QuestionnaireSchemaField,
  QuestionnaireSchemaJson,
  QuestionnaireSchemaStep,
  QuestionnaireContext,
  PositionSkillContext,
} from '@loom/contracts-questionnaires';
import {
  completionPercentVisible,
  isQuestionnaireFieldVisible,
  areStepVisibleRequiredValid,
  fieldsByKey,
  formatQuestionnaireFieldDisplay,
  choiceLabel as sharedChoiceLabel,
  resolveMatrixRatingPolicy,
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
import { skillDefinitionByCode } from '@loom/position-skill-catalog';
import type { OrganizationCatalogSnapshot } from '../../../../core/api/organization-catalog-api.service';
import { resolveOrganizationReviewLabel } from './organization-review-label';

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

export const choiceLabel = sharedChoiceLabel;

export function reviewRowsForStep(
  step: QuestionnaireSchemaStep,
  answers: Record<string, unknown>,
  profileMirror: Record<string, unknown>,
  allSteps: QuestionnaireSchemaStep[],
  options?: {
    skillLabelByCode?: (code: string) => string;
    contextVersion?: 1 | 2 | null;
    contextSkills?: PositionSkillContext[] | null;
    historicalContext?: QuestionnaireContext | null;
    liveCatalog?: OrganizationCatalogSnapshot | null;
    reviewMode?: 'draft' | 'historical';
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
      display: formatReviewDisplay(field, resolved.value, options),
      sourceLabel: visible ? reviewSourceLabel(resolved.source) : null,
      inactive: !visible && hasOwn,
    });
  }
  return rows;
}

function formatReviewDisplay(
  field: QuestionnaireSchemaField,
  value: unknown,
  options?: {
    skillLabelByCode?: (code: string) => string;
    contextVersion?: 1 | 2 | null;
    contextSkills?: PositionSkillContext[] | null;
    historicalContext?: QuestionnaireContext | null;
    liveCatalog?: OrganizationCatalogSnapshot | null;
    reviewMode?: 'draft' | 'historical';
  },
): string {
  const skillsByCode = new Map(
    (options?.contextSkills ?? []).map((s) => [s.code, s]),
  );
  const version = options?.contextVersion ?? null;

  return formatQuestionnaireFieldDisplay(field, value, {
    resolveOrgLabel: (f, v) =>
      resolveOrganizationReviewLabel({
        field: f,
        value: v,
        historicalContext: options?.historicalContext ?? null,
        liveCatalog: options?.liveCatalog ?? null,
        mode: options?.reviewMode ?? 'draft',
      }),
    resolveSkillLabel: (code) =>
      options?.skillLabelByCode?.(code) ??
      skillDefinitionByCode(code)?.labelUa ??
      code,
    formatMatrixLevel: (code, level) => {
      const policy = resolveMatrixRatingPolicy(
        version,
        skillsByCode.get(code) ?? null,
      );
      return policy.unit === '%' ? `${level}%` : String(level);
    },
  });
}

// re-export for callers that still import collectStepIssues pattern
export { collectStepIssues };
