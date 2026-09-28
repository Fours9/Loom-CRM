export {
  validateQuestionnaireSchema,
  listTopLevelFields,
  fieldsByKey,
  canonicalJson,
  schemasStructurallyEqual,
} from './schema-validation';
export type { SchemaValidationResult } from './schema-validation';

export {
  isQuestionnaireFieldVisible,
  listVisibleTopLevelFields,
} from './field-visibility';

export {
  projectVisibleQuestionnaireAnswers,
  listInactiveOwnAnswers,
} from './answer-projection';

export {
  isFieldAnswered,
  completionPercentVisible,
  areVisibleRequiredFieldsValid,
  areStepVisibleRequiredValid,
} from './completion';

export {
  parsePreferredLanguage,
  serializePreferredLanguage,
  normalizePreferredLanguageMirror,
} from './preferred-language';
export type {
  PreferredLanguageOption,
  PreferredLanguageParsed,
} from './preferred-language';

export {
  InvalidPositionSkillsMatrix,
  POSITION_SKILLS_MATRIX_LIMITS,
  emptyPositionSkillsMatrix,
  canonicalizePositionSkillsMatrix,
  pruneUnratedMatrixRatings,
  parsePositionSkillsMatrixStrict,
  isPositionSkillsMatrixMeaningful,
  validatePositionSkillsMatrixForSubmit,
  formatPositionSkillsMatrixReviewSummary,
  resolveMatrixRatingPolicy,
  validateRatingLevelAgainstPolicy,
} from './position-skills-matrix';
export type {
  PositionSkillsMatrixAnswer,
  PositionSkillRating,
  PositionSkillCustom,
  MatrixRatingPolicy,
} from './position-skills-matrix';

export {
  resolveQuestionnaireFieldValue,
} from './field-value-resolve';
export type {
  QuestionnaireFieldValueSource,
  QuestionnaireFieldValueResult,
} from './field-value-resolve';

export {
  choiceLabel,
  formatQuestionnaireFieldDisplay,
} from './field-display-format';
export type { QuestionnaireFieldFormatContext } from './field-display-format';

export { resolveQuestionnairePrintSource } from './print-source';
export type {
  QuestionnairePrintSource,
  QuestionnairePrintSourceKind,
  QuestionnairePrintDraftSlice,
  QuestionnairePrintSubmissionSlice,
} from './print-source';

export {
  buildQuestionnairePrintModel,
  coalesceGoalsPrintSteps,
  listPrintModelFieldKeys,
  mapFieldToPrintControl,
  QUESTIONNAIRE_PRINT_OMIT_FIELD_KEYS,
} from './print-model';
export type { BuildQuestionnairePrintModelInput } from './print-model';
export type { QuestionnairePrintMatrixCatalogSkill } from './field-display-format';
