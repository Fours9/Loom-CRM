import type { QuestionnaireSchemaJson } from '@loom/contracts-questionnaires';
import {
  InvalidEmployeeContactsBundle,
  parseEmployeeContactsBundleStrict,
  validateEmployeeContactsBundleForWrite,
} from '@loom/employee-contacts';
import { listTopLevelFields } from '@loom/questionnaire-schema';

export function normalizeDraftAnswersForPatch(
  schema: QuestionnaireSchemaJson,
  answers: Record<string, unknown>,
): Record<string, unknown> {
  const out = { ...answers };
  for (const field of listTopLevelFields(schema)) {
    if (field.valueType !== 'contacts_bundle') continue;
    if (!Object.prototype.hasOwnProperty.call(out, field.key)) continue;
    try {
      out[field.key] = parseEmployeeContactsBundleStrict(out[field.key]);
    } catch (err) {
      if (err instanceof InvalidEmployeeContactsBundle) throw err;
      throw new InvalidEmployeeContactsBundle('Invalid contacts bundle');
    }
  }
  return out;
}

export function validateDraftAnswersForSubmit(
  schema: QuestionnaireSchemaJson,
  answers: Record<string, unknown>,
): void {
  for (const field of listTopLevelFields(schema)) {
    if (field.valueType !== 'contacts_bundle') continue;
    if (!Object.prototype.hasOwnProperty.call(answers, field.key)) continue;
    let bundle;
    try {
      bundle = parseEmployeeContactsBundleStrict(answers[field.key]);
    } catch (err) {
      if (err instanceof InvalidEmployeeContactsBundle) throw err;
      throw new InvalidEmployeeContactsBundle('Invalid contacts bundle');
    }
    validateEmployeeContactsBundleForWrite(bundle);
  }
}
