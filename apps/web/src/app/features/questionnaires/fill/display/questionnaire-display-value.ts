import type { QuestionnaireSchemaField } from '@loom/contracts-questionnaires';
import {
  resolveQuestionnaireFieldValue,
  type QuestionnaireFieldValueSource,
} from '@loom/questionnaire-schema';

export type DisplaySource = QuestionnaireFieldValueSource;

export type FieldDisplayResult = {
  value: unknown;
  source: DisplaySource;
};

/**
 * Feature adapter over shared resolveQuestionnaireFieldValue.
 * Does not write into draft.
 */
export function resolveQuestionnaireFieldDisplay(
  field: QuestionnaireSchemaField,
  context: {
    answers: Record<string, unknown>;
    profileMirror: Record<string, unknown>;
    fieldsByKey: ReadonlyMap<string, QuestionnaireSchemaField>;
  },
): FieldDisplayResult {
  return resolveQuestionnaireFieldValue(field, context);
}

export function reviewSourceLabel(source: DisplaySource): string | null {
  switch (source) {
    case 'default_answer':
      return 'Підставлено з іншого поля';
    case 'profile_mirror':
      return 'Підставлено з профілю';
    case 'none':
      return 'Не заповнено';
    default:
      return null;
  }
}
