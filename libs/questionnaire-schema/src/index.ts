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
