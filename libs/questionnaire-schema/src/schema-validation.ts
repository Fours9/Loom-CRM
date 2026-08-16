import {
  QUESTIONNAIRE_VALUE_TYPES,
  type QuestionnaireSchemaField,
  type QuestionnaireSchemaJson,
  type QuestionnaireVisibleWhen,
} from '@loom/contracts-questionnaires';

const ALLOWED_VALUE_TYPES = new Set<string>(QUESTIONNAIRE_VALUE_TYPES);

export type SchemaValidationResult =
  | { ok: true }
  | { ok: false; errors: string[] };

const RESERVED_STEP_KEYS = new Set(['__intro__', '__review__']);

export function listTopLevelFields(
  schema: QuestionnaireSchemaJson,
): QuestionnaireSchemaField[] {
  return schema.steps.flatMap((s) => s.fields ?? []);
}

export function fieldsByKey(
  schema: QuestionnaireSchemaJson,
): Map<string, QuestionnaireSchemaField> {
  const map = new Map<string, QuestionnaireSchemaField>();
  for (const field of listTopLevelFields(schema)) {
    map.set(field.key, field);
  }
  return map;
}

export function validateQuestionnaireSchema(
  schema: QuestionnaireSchemaJson,
): SchemaValidationResult {
  const errors: string[] = [];
  const stepKeys = new Set<string>();
  const fieldKeys = new Set<string>();

  for (const step of schema.steps ?? []) {
    const sk = step.key?.trim();
    if (!sk) {
      errors.push('Schema step key is empty');
      continue;
    }
    if (RESERVED_STEP_KEYS.has(sk)) {
      errors.push(`Schema step key "${sk}" is reserved for UI`);
    }
    if (stepKeys.has(sk)) {
      errors.push(`Duplicate schema step key "${sk}"`);
    }
    stepKeys.add(sk);

    for (const field of step.fields ?? []) {
      const fk = field.key?.trim();
      if (!fk) {
        errors.push(`Empty field key in step "${sk}"`);
        continue;
      }
      if (fieldKeys.has(fk)) {
        errors.push(`Duplicate field key "${fk}"`);
      }
      fieldKeys.add(fk);

      const valueType = field.valueType?.trim();
      if (!valueType || !ALLOWED_VALUE_TYPES.has(valueType)) {
        errors.push(
          `Field "${fk}" in step "${sk}" has unknown valueType "${field.valueType ?? ''}"`,
        );
      }

      if (field.visibleWhen) {
        const vwErrors = validateVisibleWhenShape(field.key, field.visibleWhen);
        errors.push(...vwErrors);
      }
    }
  }

  const byKey = fieldsByKey(schema);

  for (const field of byKey.values()) {
    if (field.visibleWhen) {
      errors.push(
        ...validateVisibleWhenGraph(field.key, field.visibleWhen, byKey),
      );
    }
    if (field.defaultFromAnswerKey) {
      errors.push(
        ...validateDefaultFromGraph(field, byKey),
      );
    }
  }

  return errors.length ? { ok: false, errors } : { ok: true };
}

function validateVisibleWhenShape(
  fieldKey: string,
  vw: QuestionnaireVisibleWhen,
): string[] {
  const hasEquals = Object.prototype.hasOwnProperty.call(vw, 'equals');
  const hasIncludes = Object.prototype.hasOwnProperty.call(vw, 'includes');
  if (hasEquals && hasIncludes) {
    return [`Field "${fieldKey}": visibleWhen cannot have both equals and includes`];
  }
  if (!hasEquals && !hasIncludes) {
    return [`Field "${fieldKey}": visibleWhen needs equals or includes`];
  }
  if (!vw.answerKey?.trim()) {
    return [`Field "${fieldKey}": visibleWhen.answerKey is empty`];
  }
  return [];
}

function validateVisibleWhenGraph(
  fieldKey: string,
  vw: QuestionnaireVisibleWhen,
  byKey: Map<string, QuestionnaireSchemaField>,
): string[] {
  const errors: string[] = [];
  const target = vw.answerKey;
  if (target === fieldKey) {
    errors.push(`Field "${fieldKey}": visibleWhen self-reference`);
  }
  if (!byKey.has(target)) {
    errors.push(
      `Field "${fieldKey}": visibleWhen.answerKey "${target}" is not a top-level field`,
    );
    return errors;
  }
  if (hasVisibleWhenCycle(fieldKey, byKey)) {
    errors.push(`Field "${fieldKey}": visibleWhen cycle detected`);
  }
  return errors;
}

function hasVisibleWhenCycle(
  startKey: string,
  byKey: Map<string, QuestionnaireSchemaField>,
): boolean {
  const visited = new Set<string>();
  let current: string | undefined = startKey;
  while (current) {
    if (visited.has(current)) return true;
    visited.add(current);
    const field = byKey.get(current);
    current = field?.visibleWhen?.answerKey;
  }
  return false;
}

function validateDefaultFromGraph(
  field: QuestionnaireSchemaField,
  byKey: Map<string, QuestionnaireSchemaField>,
): string[] {
  const errors: string[] = [];
  const sourceKey = field.defaultFromAnswerKey!;
  if (sourceKey === field.key) {
    errors.push(`Field "${field.key}": defaultFromAnswerKey self-reference`);
  }
  const source = byKey.get(sourceKey);
  if (!source) {
    errors.push(
      `Field "${field.key}": defaultFromAnswerKey "${sourceKey}" is not a top-level field`,
    );
    return errors;
  }
  if (source.valueType !== field.valueType) {
    errors.push(
      `Field "${field.key}": defaultFromAnswerKey valueType mismatch (${source.valueType} vs ${field.valueType})`,
    );
  }
  if (hasDefaultCycle(field.key, byKey)) {
    errors.push(`Field "${field.key}": defaultFromAnswerKey cycle detected`);
  }
  return errors;
}

function hasDefaultCycle(
  startKey: string,
  byKey: Map<string, QuestionnaireSchemaField>,
): boolean {
  const visited = new Set<string>();
  let current: string | undefined = startKey;
  while (current) {
    if (visited.has(current)) return true;
    visited.add(current);
    const field = byKey.get(current);
    current = field?.defaultFromAnswerKey;
  }
  return false;
}

/** Stable canonical JSON for structural schema equality (sorted object keys). */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeysDeep(value));
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) {
      out[key] = sortKeysDeep(obj[key]);
    }
    return out;
  }
  return value;
}

export function schemasStructurallyEqual(a: unknown, b: unknown): boolean {
  return canonicalJson(a) === canonicalJson(b);
}
