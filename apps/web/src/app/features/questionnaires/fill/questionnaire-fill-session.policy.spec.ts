import { QUESTIONNAIRE_REVIEW_STEP } from '../navigation/questionnaire-step-keys';
import { resolveBrowsableQuestionnaireStep } from '../navigation/questionnaire-step-browse';
import {
  questionnaireListOpenLabel,
  shouldAutoBeginEditSession,
  shouldShowReviewSubmit,
  shouldShowRevisionSaveAndClose,
} from './questionnaire-fill-session.policy';

describe('shouldAutoBeginEditSession', () => {
  it('assigned, 0 submissions, canEditDraft → true', () => {
    expect(
      shouldAutoBeginEditSession({
        status: 'assigned',
        canEditDraft: true,
        hasSubmissions: false,
      }),
    ).toBe(true);
  });

  it('in_progress, 0 submissions, canEditDraft → true', () => {
    expect(
      shouldAutoBeginEditSession({
        status: 'in_progress',
        canEditDraft: true,
        hasSubmissions: false,
      }),
    ).toBe(true);
  });

  it('assigned without canEditDraft → false', () => {
    expect(
      shouldAutoBeginEditSession({
        status: 'assigned',
        canEditDraft: false,
        hasSubmissions: false,
      }),
    ).toBe(false);
  });

  it('reattach assigned with submissions → false', () => {
    expect(
      shouldAutoBeginEditSession({
        status: 'assigned',
        canEditDraft: true,
        hasSubmissions: true,
      }),
    ).toBe(false);
  });

  it('in_progress after reattach + autosave still has submissions → false', () => {
    expect(
      shouldAutoBeginEditSession({
        status: 'in_progress',
        canEditDraft: true,
        hasSubmissions: true,
      }),
    ).toBe(false);
  });

  it.each([
    'changes_requested',
    'submitted',
    'reviewed',
    'cancelled',
    'closed',
    'new',
  ] as const)('%s → false', (status) => {
    expect(
      shouldAutoBeginEditSession({
        status,
        canEditDraft: true,
        hasSubmissions: false,
      }),
    ).toBe(false);
  });
});

describe('shouldShowReviewSubmit / shouldShowRevisionSaveAndClose', () => {
  it('first-fill Review → only footer Надіслати', () => {
    expect(
      shouldShowReviewSubmit({
        stepKey: QUESTIONNAIRE_REVIEW_STEP,
        editable: true,
      }),
    ).toBe(true);
    expect(
      shouldShowRevisionSaveAndClose({
        stepKey: QUESTIONNAIRE_REVIEW_STEP,
        editable: true,
        isRevisionEdit: false,
      }),
    ).toBe(false);
  });

  it('revision on a schema step → chrome Зберегти і закрити, no review submit', () => {
    expect(
      shouldShowReviewSubmit({ stepKey: 'personal', editable: true }),
    ).toBe(false);
    expect(
      shouldShowRevisionSaveAndClose({
        stepKey: 'personal',
        editable: true,
        isRevisionEdit: true,
      }),
    ).toBe(true);
  });

  it('revision on Review → footer Надіслати, chrome CTA hidden', () => {
    expect(
      shouldShowReviewSubmit({
        stepKey: QUESTIONNAIRE_REVIEW_STEP,
        editable: true,
      }),
    ).toBe(true);
    expect(
      shouldShowRevisionSaveAndClose({
        stepKey: QUESTIONNAIRE_REVIEW_STEP,
        editable: true,
        isRevisionEdit: true,
      }),
    ).toBe(false);
  });

  it('read-only Review → no submit', () => {
    expect(
      shouldShowReviewSubmit({
        stepKey: QUESTIONNAIRE_REVIEW_STEP,
        editable: false,
      }),
    ).toBe(false);
  });
});

describe('load order: auto-edit before applyRequestedStep', () => {
  const schemaSteps = [{ key: 'a' }, { key: 'b' }];

  it('first-fill incomplete URL ?step=__review__ resolves linearly, not Review', () => {
    const editable = shouldAutoBeginEditSession({
      status: 'assigned',
      canEditDraft: true,
      hasSubmissions: false,
    });
    expect(editable).toBe(true);
    expect(
      resolveBrowsableQuestionnaireStep({
        requestedStepKey: QUESTIONNAIRE_REVIEW_STEP,
        editable,
        schemaSteps,
        completedStepKeys: new Set(),
      }),
    ).toBe('a');
  });

  it('read-only incomplete URL ?step=__review__ may open Review', () => {
    const editable = shouldAutoBeginEditSession({
      status: 'assigned',
      canEditDraft: true,
      hasSubmissions: true,
    });
    expect(editable).toBe(false);
    expect(
      resolveBrowsableQuestionnaireStep({
        requestedStepKey: QUESTIONNAIRE_REVIEW_STEP,
        editable,
        schemaSteps,
        completedStepKeys: new Set(),
      }),
    ).toBe(QUESTIONNAIRE_REVIEW_STEP);
  });

  it('submitted reload → policy false (read-only after first submit)', () => {
    expect(
      shouldAutoBeginEditSession({
        status: 'submitted',
        canEditDraft: false,
        hasSubmissions: true,
      }),
    ).toBe(false);
  });
});

describe('questionnaireListOpenLabel', () => {
  it('canStartFill → Почати', () => {
    expect(
      questionnaireListOpenLabel({
        canStartFill: true,
        status: 'assigned',
      }),
    ).toBe('Почати');
  });

  it('assigned without canStartFill → Відкрити', () => {
    expect(
      questionnaireListOpenLabel({
        canStartFill: false,
        status: 'assigned',
      }),
    ).toBe('Відкрити');
  });

  it('changes_requested → Відкрити', () => {
    expect(
      questionnaireListOpenLabel({
        canStartFill: false,
        status: 'changes_requested',
      }),
    ).toBe('Відкрити');
  });

  it('submitted/reviewed → Відкрити', () => {
    expect(
      questionnaireListOpenLabel({
        canStartFill: false,
        status: 'submitted',
      }),
    ).toBe('Відкрити');
  });

  it('closed → Переглянути', () => {
    expect(
      questionnaireListOpenLabel({
        canStartFill: false,
        status: 'closed',
      }),
    ).toBe('Переглянути');
  });
});
