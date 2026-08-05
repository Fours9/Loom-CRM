export type ActiveChangeRequestSubmission = {
  reviewStatus: string;
  reviewComment: string | null;
  reviewedByUserId: string | null;
  changeRequestResolution: 'completed' | 'declined' | null;
};

/**
 * Fail-closed: active reviewer request only when assignment + latest submission
 * agree, comment and reviewer id are present, and resolution is still open.
 */
export function hasActiveReviewerRequest(input: {
  assignmentStatus: string;
  latest: ActiveChangeRequestSubmission | null | undefined;
}): boolean {
  const latest = input.latest;
  if (!latest) return false;
  return (
    input.assignmentStatus === 'changes_requested' &&
    latest.reviewStatus === 'changes_requested' &&
    Boolean(latest.reviewComment?.trim()) &&
    latest.reviewedByUserId !== null &&
    latest.changeRequestResolution === null
  );
}

export function collectChangesRequestedRecipientIds(input: {
  actorId: string;
  assignedBy: { id: string } | null;
  assignedByCanEditDraft: boolean;
  activeAdminIds: string[];
}): string[] {
  const recipientIds = new Set<string>();
  const { assignedBy, assignedByCanEditDraft, activeAdminIds, actorId } = input;

  if (assignedBy && assignedBy.id !== actorId) {
    recipientIds.add(assignedBy.id);
  }

  if (!assignedBy || !assignedByCanEditDraft) {
    for (const id of activeAdminIds) {
      recipientIds.add(id);
    }
  }

  recipientIds.delete(actorId);
  return [...recipientIds];
}
