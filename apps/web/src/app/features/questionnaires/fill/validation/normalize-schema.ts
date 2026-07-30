import type {
  QuestionnaireSchemaJson,
  QuestionnaireSchemaStep,
} from '@loom/contracts-questionnaires';
import { validateQuestionnaireSchema } from '@loom/questionnaire-schema';
import {
  QUESTIONNAIRE_INTRO_STEP,
  QUESTIONNAIRE_REVIEW_STEP,
  QUESTIONNAIRE_RESERVED_STEP_KEYS,
} from '../../navigation/questionnaire-step-keys';

export type SchemaNormalizeResult =
  | { ok: true; steps: QuestionnaireSchemaStep[] }
  | { ok: false; error: string };

/** Validate uniqueness / reserved / visibleWhen / default graphs; drop empty steps. */
export function normalizeQuestionnaireSchemaSteps(
  schema: QuestionnaireSchemaJson | null | undefined,
): SchemaNormalizeResult {
  if (!schema?.steps) {
    return { ok: true, steps: [] };
  }

  const validation = validateQuestionnaireSchema(schema);
  if (!validation.ok) {
    return { ok: false, error: validation.errors[0] ?? 'Invalid schema' };
  }

  const seen = new Set<string>();
  const steps: QuestionnaireSchemaStep[] = [];

  for (const step of schema.steps) {
    const key = step.key?.trim();
    if (!key) {
      return { ok: false, error: 'Schema step key is empty' };
    }
    if (
      key === QUESTIONNAIRE_INTRO_STEP ||
      key === QUESTIONNAIRE_REVIEW_STEP ||
      (QUESTIONNAIRE_RESERVED_STEP_KEYS as readonly string[]).includes(key)
    ) {
      return {
        ok: false,
        error: `Schema step key "${key}" is reserved for UI`,
      };
    }
    if (seen.has(key)) {
      return { ok: false, error: `Duplicate schema step key "${key}"` };
    }
    seen.add(key);

    const fields = Array.isArray(step.fields) ? step.fields : [];
    if (fields.length === 0) {
      continue;
    }
    steps.push({ ...step, key, fields });
  }

  return { ok: true, steps };
}
