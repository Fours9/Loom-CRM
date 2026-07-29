/** UX-only wizard steps — must never collide with schema step keys. */
export const QUESTIONNAIRE_INTRO_STEP = '__intro__' as const;
export const QUESTIONNAIRE_REVIEW_STEP = '__review__' as const;

export const QUESTIONNAIRE_RESERVED_STEP_KEYS = [
  QUESTIONNAIRE_INTRO_STEP,
  QUESTIONNAIRE_REVIEW_STEP,
] as const;

export type QuestionnaireReservedStepKey =
  (typeof QUESTIONNAIRE_RESERVED_STEP_KEYS)[number];

export type QuestionnaireWizardStepKey = string;
