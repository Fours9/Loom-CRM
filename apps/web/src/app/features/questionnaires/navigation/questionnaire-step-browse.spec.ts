import {
  QUESTIONNAIRE_INTRO_STEP,
  QUESTIONNAIRE_REVIEW_STEP,
} from './questionnaire-step-keys';
import {
  canBrowseQuestionnaireStep,
  resolveBrowsableQuestionnaireStep,
} from './questionnaire-step-browse';

describe('questionnaire-step-browse', () => {
  const schemaSteps = [
    { key: 'a' },
    { key: 'b' },
    { key: 'c' },
  ];

  it('allows any known step in free_read_only even if incomplete', () => {
    const ctx = {
      editable: false,
      schemaSteps,
      completedStepKeys: new Set<string>(),
    };
    expect(canBrowseQuestionnaireStep('c', ctx)).toBe(true);
    expect(
      resolveBrowsableQuestionnaireStep({
        requestedStepKey: 'c',
        ...ctx,
      }),
    ).toBe('c');
    expect(
      resolveBrowsableQuestionnaireStep({
        requestedStepKey: QUESTIONNAIRE_REVIEW_STEP,
        ...ctx,
      }),
    ).toBe(QUESTIONNAIRE_REVIEW_STEP);
  });

  it('blocks future steps in linear_edit until prior complete', () => {
    const ctx = {
      editable: true,
      schemaSteps,
      completedStepKeys: new Set(['a']),
    };
    expect(canBrowseQuestionnaireStep('c', ctx)).toBe(false);
    expect(canBrowseQuestionnaireStep('b', ctx)).toBe(true);
    expect(
      resolveBrowsableQuestionnaireStep({
        requestedStepKey: 'c',
        ...ctx,
      }),
    ).toBe('b');
  });

  it('allows intro always', () => {
    expect(
      canBrowseQuestionnaireStep(QUESTIONNAIRE_INTRO_STEP, {
        editable: true,
        schemaSteps,
        completedStepKeys: new Set(),
      }),
    ).toBe(true);
  });
});
