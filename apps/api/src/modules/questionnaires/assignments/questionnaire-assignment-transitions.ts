import type { QuestionnaireAssignmentStatus } from '../questionnaire.enums';

const CANCELLABLE_STATUSES = new Set<QuestionnaireAssignmentStatus>([
  'assigned',
  'in_progress',
  'submitted',
  'changes_requested',
  'reviewed',
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

const REVISION_START_STATUSES = new Set<QuestionnaireAssignmentStatus>([
  'submitted',
  'reviewed',
]);

export function canCancelAssignment(
  status: QuestionnaireAssignmentStatus | string,
): boolean {
  return CANCELLABLE_STATUSES.has(status as QuestionnaireAssignmentStatus);
}

export function canReactivateAssignment(
  status: QuestionnaireAssignmentStatus | string,
): boolean {
  return status === 'cancelled';
}

export function canCloseAssignment(
  status: QuestionnaireAssignmentStatus | string,
): boolean {
  return CLOSABLE_STATUSES.has(status as QuestionnaireAssignmentStatus);
}

export function isOwnerEditableStatus(
  status: QuestionnaireAssignmentStatus | string,
): boolean {
  return OWNER_EDITABLE_STATUSES.has(status as QuestionnaireAssignmentStatus);
}

export function canStartRevisionFromStatus(
  status: QuestionnaireAssignmentStatus | string,
): boolean {
  return REVISION_START_STATUSES.has(status as QuestionnaireAssignmentStatus);
}

export const QUESTIONNAIRE_ASSIGNMENT_AUDIT = {
  cancelled: 'questionnaire.assignment.cancelled',
  reactivated: 'questionnaire.assignment.reactivated',
  closed: 'questionnaire.assignment.closed',
  deleted: 'questionnaire.assignment.deleted',
} as const;
