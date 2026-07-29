import {
  buildQuestionnaireAssignmentLink,
  parseQuestionnaireStepQuery,
} from './questionnaire-navigation';
import {
  QUESTIONNAIRE_INTRO_STEP,
  QUESTIONNAIRE_REVIEW_STEP,
} from './questionnaire-step-keys';
import { resolveQuestionnaireActiveStep } from './resolve-active-step';

describe('buildQuestionnaireAssignmentLink', () => {
  it('builds link without step', () => {
    expect(buildQuestionnaireAssignmentLink({ assignmentId: ' a1 ' })).toEqual({
      routerLink: '/questionnaires/a1',
      queryParams: {},
    });
  });

  it('builds link with step', () => {
    expect(
      buildQuestionnaireAssignmentLink({
        assignmentId: 'a1',
        stepKey: ' family ',
      }),
    ).toEqual({
      routerLink: '/questionnaires/a1',
      queryParams: { step: 'family' },
    });
  });

  it('trims empty step', () => {
    expect(
      buildQuestionnaireAssignmentLink({ assignmentId: 'a1', stepKey: '  ' }),
    ).toEqual({
      routerLink: '/questionnaires/a1',
      queryParams: {},
    });
  });
});

describe('parseQuestionnaireStepQuery', () => {
  it('trims step', () => {
    expect(
      parseQuestionnaireStepQuery({
        get: (n) => (n === 'step' ? '  profile_mirror  ' : null),
      }),
    ).toBe('profile_mirror');
  });
});

describe('resolveQuestionnaireActiveStep', () => {
  const schemaSteps = [{ key: 'a' }, { key: 'b' }, { key: 'c' }];

  it('falls back unknown step to first incomplete', () => {
    expect(
      resolveQuestionnaireActiveStep({
        requestedStepKey: 'nope',
        schemaSteps,
        completedStepKeys: ['a'],
      }),
    ).toBe('b');
  });

  it('blocks future step until prior complete', () => {
    expect(
      resolveQuestionnaireActiveStep({
        requestedStepKey: 'c',
        schemaSteps,
        completedStepKeys: ['a'],
      }),
    ).toBe('b');
  });

  it('allows review when all complete', () => {
    expect(
      resolveQuestionnaireActiveStep({
        requestedStepKey: QUESTIONNAIRE_REVIEW_STEP,
        schemaSteps,
        completedStepKeys: ['a', 'b', 'c'],
      }),
    ).toBe(QUESTIONNAIRE_REVIEW_STEP);
  });

  it('falls back review when incomplete', () => {
    expect(
      resolveQuestionnaireActiveStep({
        requestedStepKey: QUESTIONNAIRE_REVIEW_STEP,
        schemaSteps,
        completedStepKeys: ['a'],
      }),
    ).toBe('b');
  });

  it('defaults to intro when nothing completed', () => {
    expect(
      resolveQuestionnaireActiveStep({
        requestedStepKey: null,
        schemaSteps,
        completedStepKeys: [],
      }),
    ).toBe(QUESTIONNAIRE_INTRO_STEP);
  });

  it('empty schema defaults to intro', () => {
    expect(
      resolveQuestionnaireActiveStep({
        requestedStepKey: null,
        schemaSteps: [],
        completedStepKeys: [],
      }),
    ).toBe(QUESTIONNAIRE_INTRO_STEP);
  });
});
