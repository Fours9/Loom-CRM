import {
  isQuestionnairePostSubmitStatus,
  type QuestionnaireAssignmentStatus as ContractStatus,
} from '@loom/contracts-questionnaires';
import type { QuestionnaireAssignmentStatus } from '../questionnaire.enums';

const CANCELLABLE_STATUSES = new Set<QuestionnaireAssignmentStatus>([
  'assigned',
  'in_progress',
  'submitted',
  'changes_requested',
  'reviewed',
  /** Post-submit lock-in (submit→closed); same detach as legacy submitted. */
  'closed',
]);

const CLOSABLE_STATUSES = new Set<QuestionnaireAssignmentStatus>([
  'assigned',
  'in_progress',
  'submitted',
  'changes_requested',
  'reviewed',
  'cancelled',
]);

const OWNER_EDITABLE_STATUSES = new Set<QuestionnaireAssignmentStatus>([
  'assigned',
  'in_progress',
  'changes_requested',
]);

export function canCancelAssignment(
  status: QuestionnaireAssignmentStatus | string,
): boolean {
  return CANCELLABLE_STATUSES.has(status as QuestionnaireAssignmentStatus);
}

export function canCloseAssignment(
  status: QuestionnaireAssignmentStatus | string,
): boolean {
  return CLOSABLE_STATUSES.has(status as QuestionnaireAssignmentStatus);
}

export function canAttachAssignment(input: {
  status: QuestionnaireAssignmentStatus | string;
  employeeId: string | null | undefined;
  detachedFromEmployeeId: string | null | undefined;
}): boolean {
  const employeeId = input.employeeId ?? null;
  const detached = input.detachedFromEmployeeId ?? null;
  if (input.status === 'new') {
    return employeeId === null && detached === null;
  }
  if (input.status === 'cancelled') {
    return employeeId === null && detached !== null;
  }
  return false;
}

export function isOwnerEditableStatus(
  status: QuestionnaireAssignmentStatus | string,
): boolean {
  return OWNER_EDITABLE_STATUSES.has(status as QuestionnaireAssignmentStatus);
}

/**
 * Revision / request-changes eligibility from assignment + latest submission facts.
 * Fail-closed: post-submit without a submission (manual close / integrity anomaly) → false.
 */
export function canStartRevisionFromState(input: {
  status: QuestionnaireAssignmentStatus | string | ContractStatus;
  latestSubmission: unknown | null | undefined;
}): boolean {
  if (!isQuestionnairePostSubmitStatus(String(input.status))) {
    return false;
  }
  return input.latestSubmission != null;
}

export const QUESTIONNAIRE_ASSIGNMENT_AUDIT = {
  cancelled: 'questionnaire.assignment.cancelled',
  attached: 'questionnaire.assignment.attached',
  closed: 'questionnaire.assignment.closed',
  deleted: 'questionnaire.assignment.deleted',
} as const;
