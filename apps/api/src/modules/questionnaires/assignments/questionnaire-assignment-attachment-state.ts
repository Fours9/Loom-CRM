import type { QuestionnaireAssignmentStatus } from '../questionnaire.enums';

export type QuestionnaireAttachmentState =
  | 'attached'
  | 'detached'
  | 'closed';

export function attachmentStateForStatus(
  status: QuestionnaireAssignmentStatus | string,
): QuestionnaireAttachmentState {
  if (status === 'closed') return 'closed';
  if (status === 'cancelled') return 'detached';
  return 'attached';
}

/** Statuses that map to UI filter attachmentState=attached. */
export const ATTACHED_STATUSES: readonly QuestionnaireAssignmentStatus[] = [
  'assigned',
  'in_progress',
  'submitted',
  'changes_requested',
  'reviewed',
] as const;
