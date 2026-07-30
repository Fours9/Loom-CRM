import type {
  QuestionnaireSchemaField,
  QuestionnaireSchemaJson,
} from '@loom/contracts-questionnaires';
import { listTopLevelFields } from './schema-validation';

function hasOwn(obj: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

/**
 * Visibility uses own draft answers only (not profile mirror).
 * Missing controlling answer → hidden.
 */
export function isQuestionnaireFieldVisible(
  field: QuestionnaireSchemaField,
  answers: Record<string, unknown>,
): boolean {
  const vw = field.visibleWhen;
  if (!vw) return true;

  if (!hasOwn(answers, vw.answerKey)) return false;
  const controlling = answers[vw.answerKey];

  if (Object.prototype.hasOwnProperty.call(vw, 'equals')) {
    return controlling === vw.equals;
  }

  // includes branch
  if (!Array.isArray(controlling)) return false;
  return controlling.includes(vw.includes);
}

export function listVisibleTopLevelFields(
  schema: QuestionnaireSchemaJson,
  answers: Record<string, unknown>,
): QuestionnaireSchemaField[] {
  return listTopLevelFields(schema).filter((f) =>
    isQuestionnaireFieldVisible(f, answers),
  );
}
