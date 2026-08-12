import type {
  QuestionnaireSchemaField,
  QuestionnaireSchemaJson,
  QuestionnaireSchemaStep,
} from '@loom/contracts-questionnaires';
import {
  isEmployeeContactsBundleMeaningful,
  parseEmployeeContactsBundleStrict,
} from '@loom/employee-contacts';
import { isQuestionnaireFieldVisible } from './field-visibility';

function isMeaningfulScalar(value: unknown): boolean {
  if (value === false || value === 0) return true;
  if (value === undefined || value === null || value === '') return false;
  if (Array.isArray(value) && value.length === 0) return false;
  return true;
}

/** Repeating group is answered only if a row has a meaningful child value. */
export function isFieldAnswered(
  field: QuestionnaireSchemaField,
  value: unknown,
): boolean {
  if (field.valueType === 'contacts_bundle') {
    try {
      const bundle = parseEmployeeContactsBundleStrict(value);
      return isEmployeeContactsBundleMeaningful(bundle);
    } catch {
      return false;
    }
  }
  if (field.valueType === 'repeating_group') {
    if (!Array.isArray(value) || value.length === 0) return false;
    const childKeys = (field.children ?? []).map((c) => c.key);
    return value.some((row) => {
      if (!row || typeof row !== 'object' || Array.isArray(row)) return false;
      const obj = row as Record<string, unknown>;
      return childKeys.some((k) => isMeaningfulScalar(obj[k]));
    });
  }
  if (field.valueType === 'boolean') {
    return value === true || value === false;
  }
  return isMeaningfulScalar(value);
}

/**
 * Completion = answered visible fields / visible fields.
 * Denominator 0 → 0%. Default display without own answer does not count (caller
 * must pass own answers only).
 */
export function completionPercentVisible(
  schema: QuestionnaireSchemaJson,
  answers: Record<string, unknown>,
): number {
  const visible = schema.steps
    .flatMap((s) => s.fields ?? [])
    .filter((f) => isQuestionnaireFieldVisible(f, answers));
  if (visible.length === 0) return 0;

  let answered = 0;
  for (const field of visible) {
    if (!Object.prototype.hasOwnProperty.call(answers, field.key)) continue;
    if (isFieldAnswered(field, answers[field.key])) answered += 1;
  }
  return Math.round((answered / visible.length) * 100);
}

/** Navigation: all visible required fields valid (empty required-less → true). */
export function areVisibleRequiredFieldsValid(
  fields: QuestionnaireSchemaField[],
  answers: Record<string, unknown>,
  isFieldValid: (field: QuestionnaireSchemaField, value: unknown) => boolean,
): boolean {
  for (const field of fields) {
    if (!isQuestionnaireFieldVisible(field, answers)) continue;
    if (field.requiredPolicy !== 'required') continue;
    const value = Object.prototype.hasOwnProperty.call(answers, field.key)
      ? answers[field.key]
      : undefined;
    if (!isFieldValid(field, value)) return false;
  }
  return true;
}

export function areStepVisibleRequiredValid(
  step: QuestionnaireSchemaStep,
  answers: Record<string, unknown>,
  isFieldValid: (field: QuestionnaireSchemaField, value: unknown) => boolean,
): boolean {
  return areVisibleRequiredFieldsValid(step.fields ?? [], answers, isFieldValid);
}
