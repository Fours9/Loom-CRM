import type { QuestionnaireSchemaJson } from '@loom/contracts-questionnaires';
import {
  InvalidEmployeeContactsBundle,
  parseEmployeeContactsBundleStrict,
  validateEmployeeContactsBundleForWrite,
} from '@loom/employee-contacts';
import {
  InvalidPositionSkillsMatrix,
  listTopLevelFields,
  parsePositionSkillsMatrixStrict,
  validatePositionSkillsMatrixForSubmit,
} from '@loom/questionnaire-schema';

export function normalizeDraftAnswersForPatch(
  schema: QuestionnaireSchemaJson,
  answers: Record<string, unknown>,
): Record<string, unknown> {
  const out = { ...answers };
  for (const field of listTopLevelFields(schema)) {
    if (!Object.prototype.hasOwnProperty.call(out, field.key)) continue;
    if (field.valueType === 'contacts_bundle') {
      try {
        out[field.key] = parseEmployeeContactsBundleStrict(out[field.key]);
      } catch (err) {
        if (err instanceof InvalidEmployeeContactsBundle) throw err;
        throw new InvalidEmployeeContactsBundle('Invalid contacts bundle');
      }
      continue;
    }
    if (field.valueType === 'position_skills_matrix') {
      try {
        out[field.key] = parsePositionSkillsMatrixStrict(out[field.key]);
      } catch (err) {
        if (err instanceof InvalidPositionSkillsMatrix) throw err;
        throw new InvalidPositionSkillsMatrix('Invalid skills matrix');
      }
    }
  }
  return out;
}

export function validateDraftAnswersForSubmit(
  schema: QuestionnaireSchemaJson,
  answers: Record<string, unknown>,
  options?: { allowedSkillCodes?: ReadonlySet<string> | readonly string[] },
): void {
  for (const field of listTopLevelFields(schema)) {
    if (!Object.prototype.hasOwnProperty.call(answers, field.key)) continue;
    if (field.valueType === 'contacts_bundle') {
      let bundle;
      try {
        bundle = parseEmployeeContactsBundleStrict(answers[field.key]);
      } catch (err) {
        if (err instanceof InvalidEmployeeContactsBundle) throw err;
        throw new InvalidEmployeeContactsBundle('Invalid contacts bundle');
      }
      validateEmployeeContactsBundleForWrite(bundle);
      continue;
    }
    if (field.valueType === 'position_skills_matrix') {
      let matrix;
      try {
        matrix = parsePositionSkillsMatrixStrict(answers[field.key]);
      } catch (err) {
        if (err instanceof InvalidPositionSkillsMatrix) throw err;
        throw new InvalidPositionSkillsMatrix('Invalid skills matrix');
      }
      validatePositionSkillsMatrixForSubmit(
        matrix,
        options?.allowedSkillCodes,
      );
    }
  }
}
