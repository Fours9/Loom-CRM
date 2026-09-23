import type { QuestionnaireSchemaField } from '@loom/contracts-questionnaires';
import {
  emptyEmployeeContactsBundle,
  formatContactsBundleReviewSummary,
  normalizeEmployeeContactsBundle,
} from '@loom/employee-contacts';
import {
  formatPositionSkillsMatrixReviewSummary,
  parsePositionSkillsMatrixStrict,
} from './position-skills-matrix';

export type QuestionnaireFieldFormatContext = {
  /** Required for organization_ref; return raw id / «—» when unknown. */
  resolveOrgLabel: (
    field: QuestionnaireSchemaField,
    value: unknown,
  ) => string;
  resolveSkillLabel?: (code: string) => string;
  formatMatrixLevel?: (code: string, level: number) => string;
};

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

/**
 * Format one field's raw value for review/PDF display.
 * Repeating groups return a compact «N запис(ів)» summary — print model
 * expands structured rows separately.
 */
export function formatQuestionnaireFieldDisplay(
  field: QuestionnaireSchemaField,
  value: unknown,
  formatContext: QuestionnaireFieldFormatContext,
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
        (code) => formatContext.resolveSkillLabel?.(code) ?? code,
        (code, level) =>
          formatContext.formatMatrixLevel?.(code, level) ?? String(level),
      );
    } catch {
      return '—';
    }
  }
  if (field.valueType === 'organization_ref') {
    return formatContext.resolveOrgLabel(field, value);
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
