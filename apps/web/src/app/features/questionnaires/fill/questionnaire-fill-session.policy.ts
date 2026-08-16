import type { QuestionnaireAssignmentStatus } from '@loom/contracts-questionnaires';
import { QUESTIONNAIRE_REVIEW_STEP } from '../navigation/questionnaire-step-keys';

export type AutoBeginEditSessionInput = {
  status: QuestionnaireAssignmentStatus | string;
  canEditDraft: boolean;
  hasSubmissions: boolean;
};

export type ReviewSubmitInput = {
  stepKey: string;
  editable: boolean;
};

export type RevisionSaveAndCloseInput = {
  stepKey: string;
  editable: boolean;
  isRevisionEdit: boolean;
};

/**
 * First-fill only: assigned/in_progress + canEditDraft + no submissions.
 * Reattach after cancel keeps submissions → not auto-edit (revision/history).
 */
export function shouldAutoBeginEditSession(
  input: AutoBeginEditSessionInput,
): boolean {
  return (
    input.canEditDraft &&
    !input.hasSubmissions &&
    (input.status === 'assigned' || input.status === 'in_progress')
  );
}

export function shouldShowReviewSubmit(input: ReviewSubmitInput): boolean {
  return input.editable && input.stepKey === QUESTIONNAIRE_REVIEW_STEP;
}

export function shouldShowRevisionSaveAndClose(
  input: RevisionSaveAndCloseInput,
): boolean {
  return (
    input.editable &&
    input.isRevisionEdit &&
    input.stepKey !== QUESTIONNAIRE_REVIEW_STEP
  );
}

export function questionnaireListOpenLabel(input: {
  canStartFill: boolean;
  status: QuestionnaireAssignmentStatus | string;
}): string {
  if (input.canStartFill) return 'Почати';
  if (input.status === 'submitted' || input.status === 'reviewed') {
    return 'Відкрити';
  }
  if (
    input.status === 'assigned' ||
    input.status === 'in_progress' ||
    input.status === 'changes_requested'
  ) {
    return 'Відкрити';
  }
  return 'Переглянути';
}
