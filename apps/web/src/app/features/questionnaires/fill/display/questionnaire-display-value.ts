import type { QuestionnaireSchemaField } from '@loom/contracts-questionnaires';
import { normalizePreferredLanguageMirror } from '@loom/questionnaire-schema';

export type DisplaySource =
  | 'answer'
  | 'default_answer'
  | 'profile_mirror'
  | 'none';

export type FieldDisplayResult = {
  value: unknown;
  source: DisplaySource;
};

function hasOwn(obj: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

/**
 * Feature-private display resolver (profile mirror + defaultFromAnswerKey).
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
  const { answers, profileMirror, fieldsByKey } = context;

  if (hasOwn(answers, field.key)) {
    let value = answers[field.key];
    if (field.valueType === 'contacts_bundle') {
      return { value, source: 'answer' };
    }
    if (field.key === 'personal.preferred_language') {
      const parsed = normalizePreferredLanguageMirror(
        value,
        field.options ?? [],
      );
      value = parsed.selected;
    }
    return { value, source: 'answer' };
  }

  if (field.defaultFromAnswerKey) {
    const sourceField = fieldsByKey.get(field.defaultFromAnswerKey);
    if (sourceField && hasOwn(answers, field.defaultFromAnswerKey)) {
      return {
        value: answers[field.defaultFromAnswerKey],
        source: 'default_answer',
      };
    }
    if (sourceField) {
      const mirrorKey = sourceField.proposalMapping?.field;
      if (mirrorKey && hasOwn(profileMirror, mirrorKey)) {
        return {
          value: profileMirror[mirrorKey],
          source: 'profile_mirror',
        };
      }
    }
  }

  if (field.valueType === 'contacts_bundle') {
    if (hasOwn(profileMirror, 'contactsBundle')) {
      return {
        value: profileMirror['contactsBundle'],
        source: 'profile_mirror',
      };
    }
    return { value: undefined, source: 'none' };
  }

  const mirrorKey = field.profileMirrorKey ?? field.proposalMapping?.field;
  if (mirrorKey && hasOwn(profileMirror, mirrorKey)) {
    let value: unknown = profileMirror[mirrorKey];
    if (field.valueType === 'multi_choice' && field.key === 'personal.preferred_language') {
      const parsed = normalizePreferredLanguageMirror(
        value,
        field.options ?? [],
      );
      value = parsed.selected;
    }
    return { value, source: 'profile_mirror' };
  }

  return { value: undefined, source: 'none' };
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
