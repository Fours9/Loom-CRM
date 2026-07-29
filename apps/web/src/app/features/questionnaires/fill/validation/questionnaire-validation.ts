import type { QuestionnaireSchemaField } from '@loom/contracts-questionnaires';
import { isIsoDateOnly } from './iso-date';

export type FieldValidationIssue = {
  fieldKey: string;
  message: string;
  severity: 'error' | 'warning';
};

export function hasOwnAnswer(
  answers: Record<string, unknown>,
  key: string,
): boolean {
  return Object.prototype.hasOwnProperty.call(answers, key);
}

export function displayFieldValue(
  answers: Record<string, unknown>,
  profileMirror: Record<string, unknown>,
  field: QuestionnaireSchemaField,
): unknown {
  if (hasOwnAnswer(answers, field.key)) {
    return answers[field.key];
  }
  const mirrorKey = field.proposalMapping?.field;
  if (
    mirrorKey &&
    Object.prototype.hasOwnProperty.call(profileMirror, mirrorKey)
  ) {
    return profileMirror[mirrorKey];
  }
  return undefined;
}

export function isValueEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string' && value.trim() === '') return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
}

export function parseNumberInput(raw: string): number | null {
  const normalized = raw.trim().replace(',', '.');
  if (!normalized) return null;
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

export function validateFieldValue(
  field: QuestionnaireSchemaField,
  value: unknown,
): FieldValidationIssue | null {
  const policy = field.requiredPolicy ?? 'voluntary';

  if (field.valueType === 'boolean') {
    if (value !== undefined && value !== null && typeof value !== 'boolean') {
      return {
        fieldKey: field.key,
        message: `${field.label}: очікується так/ні`,
        severity: 'error',
      };
    }
    if (policy === 'required' && value !== true && value !== false) {
      return {
        fieldKey: field.key,
        message: `Обовʼязкове поле: ${field.label}`,
        severity: 'error',
      };
    }
    return null;
  }

  if (policy === 'required' && isValueEmpty(value)) {
    return {
      fieldKey: field.key,
      message: `Обовʼязкове поле: ${field.label}`,
      severity: 'error',
    };
  }

  if (field.valueType === 'repeating_group') {
    const rows = Array.isArray(value) ? value : isValueEmpty(value) ? [] : null;
    if (rows === null) {
      return {
        fieldKey: field.key,
        message: `${field.label}: очікується список`,
        severity: 'error',
      };
    }
    if (field.minItems !== undefined && rows.length < field.minItems) {
      return {
        fieldKey: field.key,
        message: `${field.label}: мінімум ${field.minItems} записів`,
        severity: 'error',
      };
    }
    if (field.maxItems !== undefined && rows.length > field.maxItems) {
      return {
        fieldKey: field.key,
        message: `${field.label}: максимум ${field.maxItems} записів`,
        severity: 'error',
      };
    }
    const children = field.children ?? [];
    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i];
      if (!row || typeof row !== 'object' || Array.isArray(row)) {
        return {
          fieldKey: field.key,
          message: `${field.label}: некоректний рядок ${i + 1}`,
          severity: 'error',
        };
      }
      const rowObj = row as Record<string, unknown>;
      for (const child of children) {
        const childIssue = validateFieldValue(child, rowObj[child.key]);
        if (childIssue && childIssue.severity === 'error') {
          return {
            fieldKey: `${field.key}[${i}].${child.key}`,
            message: `${field.label} #${i + 1}: ${childIssue.message}`,
            severity: 'error',
          };
        }
      }
    }
    return null;
  }

  if (isValueEmpty(value)) {
    return null;
  }

  if (field.valueType === 'date' && typeof value === 'string') {
    if (!isIsoDateOnly(value)) {
      return {
        fieldKey: field.key,
        message: `${field.label}: некоректна дата`,
        severity: 'error',
      };
    }
  }

  if (field.valueType === 'number') {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return {
        fieldKey: field.key,
        message: `${field.label}: очікується число`,
        severity: 'error',
      };
    }
    if (field.min !== undefined && value < field.min) {
      return {
        fieldKey: field.key,
        message: `${field.label}: мінімум ${field.min}`,
        severity: 'error',
      };
    }
    if (field.max !== undefined && value > field.max) {
      return {
        fieldKey: field.key,
        message: `${field.label}: максимум ${field.max}`,
        severity: 'error',
      };
    }
  }

  if (field.valueType === 'single_choice' && typeof value === 'string') {
    const ok = field.options?.some((o) => o.value === value);
    if (field.options?.length && !ok) {
      return {
        fieldKey: field.key,
        message: `${field.label}: недоступний варіант`,
        severity: 'error',
      };
    }
  }

  if (field.valueType === 'multi_choice' && Array.isArray(value)) {
    const allowed = new Set((field.options ?? []).map((o) => o.value));
    if (allowed.size) {
      for (const v of value) {
        if (typeof v !== 'string' || !allowed.has(v)) {
          return {
            fieldKey: field.key,
            message: `${field.label}: недоступний варіант`,
            severity: 'error',
          };
        }
      }
    }
  }

  return null;
}

export function validateFieldRecommended(
  field: QuestionnaireSchemaField,
  value: unknown,
): FieldValidationIssue | null {
  if (field.requiredPolicy !== 'recommended') return null;
  if (field.valueType === 'boolean') {
    if (value !== true && value !== false) {
      return {
        fieldKey: field.key,
        message: `Рекомендовано: ${field.label}`,
        severity: 'warning',
      };
    }
    return null;
  }
  if (isValueEmpty(value)) {
    return {
      fieldKey: field.key,
      message: `Рекомендовано: ${field.label}`,
      severity: 'warning',
    };
  }
  return null;
}

export function isRequiredFieldValid(
  field: QuestionnaireSchemaField,
  value: unknown,
): boolean {
  const issue = validateFieldValue(field, value);
  return !issue || issue.severity !== 'error';
}

/** Required-policy fields only — used for step completion / progress. */
export function areStepRequiredFieldsValid(
  fields: QuestionnaireSchemaField[],
  answers: Record<string, unknown>,
  profileMirror: Record<string, unknown>,
): boolean {
  for (const field of fields) {
    if (field.requiredPolicy !== 'required') continue;
    const value = displayFieldValue(answers, profileMirror, field);
    if (!isRequiredFieldValid(field, value)) return false;
  }
  return true;
}

export function collectStepIssues(
  fields: QuestionnaireSchemaField[],
  answers: Record<string, unknown>,
  profileMirror: Record<string, unknown>,
): FieldValidationIssue[] {
  const issues: FieldValidationIssue[] = [];
  for (const field of fields) {
    const value = displayFieldValue(answers, profileMirror, field);
    const err = validateFieldValue(field, value);
    if (err) issues.push(err);
    const warn = validateFieldRecommended(field, value);
    if (warn) issues.push(warn);
  }
  return issues;
}
