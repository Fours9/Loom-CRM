import type {
  QuestionnaireAssignmentStatus,
  QuestionnaireSubmissionSummary,
} from '@loom/contracts-questionnaires';

export function hasActiveReviewerRequest(input: {
  assignmentStatus: QuestionnaireAssignmentStatus | string;
  latest: Pick<
    QuestionnaireSubmissionSummary,
    | 'reviewStatus'
    | 'reviewComment'
    | 'reviewedByUserId'
    | 'changeRequestResolution'
  > | null | undefined;
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
