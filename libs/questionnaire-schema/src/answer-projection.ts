import type {
  QuestionnaireSchemaField,
  QuestionnaireSchemaJson,
} from '@loom/contracts-questionnaires';
import {
  canonicalEmployeeContactsBundle,
  parseEmployeeContactsBundleStrict,
} from '@loom/employee-contacts';
import { isQuestionnaireFieldVisible } from './field-visibility';
import { listTopLevelFields } from './schema-validation';

function isMeaningfulScalar(value: unknown): boolean {
  if (value === false || value === 0) return true;
  if (value === undefined || value === null || value === '') return false;
  if (Array.isArray(value) && value.length === 0) return false;
  return true;
}

function projectRepeatingRows(
  field: QuestionnaireSchemaField,
  value: unknown,
): unknown[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const childKeys = (field.children ?? []).map((c) => c.key);
  const rows: Record<string, unknown>[] = [];

  for (const row of value) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) continue;
    const src = row as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    let hasMeaningful = false;
    for (const key of childKeys) {
      if (!Object.prototype.hasOwnProperty.call(src, key)) continue;
      const v = src[key];
      if (!isMeaningfulScalar(v)) continue;
      out[key] = v;
      hasMeaningful = true;
    }
    if (hasMeaningful) rows.push(out);
  }

  return rows.length ? rows : undefined;
}

/**
 * Canonical snapshot from draft. Visibility evaluated against full original draft.
 */
export function projectVisibleQuestionnaireAnswers(
  schema: QuestionnaireSchemaJson,
  draftAnswers: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  for (const field of listTopLevelFields(schema)) {
    if (!isQuestionnaireFieldVisible(field, draftAnswers)) continue;
    if (!Object.prototype.hasOwnProperty.call(draftAnswers, field.key)) continue;

    const raw = draftAnswers[field.key];

    if (field.valueType === 'contacts_bundle') {
      const parsed = parseEmployeeContactsBundleStrict(raw);
      out[field.key] = canonicalEmployeeContactsBundle(parsed);
      continue;
    }

    if (field.valueType === 'repeating_group') {
      const rows = projectRepeatingRows(field, raw);
      if (rows) out[field.key] = rows;
      continue;
    }

    if (!isMeaningfulScalar(raw)) continue;
    out[field.key] = raw;
  }

  return out;
}

/** Hidden fields that still have own answers (for Review warnings). */
export function listInactiveOwnAnswers(
  schema: QuestionnaireSchemaJson,
  draftAnswers: Record<string, unknown>,
): string[] {
  const inactive: string[] = [];
  for (const field of listTopLevelFields(schema)) {
    if (!Object.prototype.hasOwnProperty.call(draftAnswers, field.key)) continue;
    if (isQuestionnaireFieldVisible(field, draftAnswers)) continue;
    const raw = draftAnswers[field.key];
    if (field.valueType === 'contacts_bundle') {
      inactive.push(field.key);
      continue;
    }
    if (field.valueType === 'repeating_group') {
      if (!Array.isArray(raw) || !projectRepeatingRows(field, raw)) continue;
      inactive.push(field.key);
      continue;
    }
    if (!isMeaningfulScalar(raw)) continue;
    inactive.push(field.key);
  }
  return inactive;
}
