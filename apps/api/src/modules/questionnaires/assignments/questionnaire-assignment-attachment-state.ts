import type {
  QuestionnaireAssignmentStatus,
  QuestionnaireAttachmentState,
} from '@loom/contracts-questionnaires';

const ATTACHMENT_STATE_BY_STATUS = {
  new: 'new',
  assigned: 'attached',
  in_progress: 'attached',
  submitted: 'attached',
  changes_requested: 'attached',
  reviewed: 'attached',
  cancelled: 'detached',
  closed: 'closed',
} as const satisfies Record<
  QuestionnaireAssignmentStatus,
  QuestionnaireAttachmentState
>;

export type { QuestionnaireAttachmentState };

export function attachmentStateForStatus(
  status: QuestionnaireAssignmentStatus | string,
): QuestionnaireAttachmentState {
  const mapped =
    ATTACHMENT_STATE_BY_STATUS[status as QuestionnaireAssignmentStatus];
  if (!mapped) {
    throw new Error(`Unknown questionnaire assignment status: ${status}`);
  }
  return mapped;
}

/** Statuses that map to UI filter attachmentState=attached. */
export const ATTACHED_STATUSES: readonly QuestionnaireAssignmentStatus[] = [
  'assigned',
  'in_progress',
  'submitted',
  'changes_requested',
  'reviewed',
] as const;
