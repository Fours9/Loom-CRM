export type QuestionnaireNavigationMode = 'linear_edit' | 'free_read_only';

export function resolveQuestionnaireNavigationMode(input: {
  editable: boolean;
}): QuestionnaireNavigationMode {
  return input.editable ? 'linear_edit' : 'free_read_only';
}

/** Whether a schema step (or review) may be opened under the given mode. */
export function isQuestionnaireStepBrowsable(input: {
  mode: QuestionnaireNavigationMode;
  linearReachable: boolean;
}): boolean {
  if (input.mode === 'free_read_only') return true;
  return input.linearReachable;
}
