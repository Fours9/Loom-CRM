import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { isQuestionnairePostSubmitStatus } from '@loom/contracts-questionnaires';
import { QuestionnaireAssignment } from '../questionnaire-assignment.entity';
import { QuestionnaireResponse } from '../questionnaire-response.entity';
import { QuestionnaireSubmission } from '../questionnaire-submission.entity';
import { supersedePendingForSubmission } from '../proposals/questionnaire-proposal-lifecycle';
import { parseAssignmentContext } from '../assignments/questionnaire-context-access';

export { parseAssignmentContext };

export type QuestionnaireReopenCause =
  | { kind: 'owner_reopen'; actorUserId: string }
  | { kind: 'admin_start_revision'; actorUserId: string };

export type ReopenTransitionResult = {
  submission: QuestionnaireSubmission;
  assignment: QuestionnaireAssignment;
};

/**
 * Shared assignment → changes_requested for owner/admin revision.
 * Reviewer request-changes uses applyReviewTransition instead.
 */
export async function applyReopenTransition(
  manager: EntityManager,
  assignment: QuestionnaireAssignment,
  cause: QuestionnaireReopenCause,
): Promise<ReopenTransitionResult> {
  if (!isQuestionnairePostSubmitStatus(assignment.status)) {
    throw new BadRequestException(
      `Cannot reopen from status ${assignment.status}`,
    );
  }

  const response = await manager.getRepository(QuestionnaireResponse).findOne({
    where: { assignmentId: assignment.id },
    lock: { mode: 'pessimistic_write' },
  });
  if (!response) throw new NotFoundException('Response not found');

  const latest = await manager.getRepository(QuestionnaireSubmission).findOne({
    where: { responseId: response.id },
    order: { submissionNumber: 'DESC' },
    lock: { mode: 'pessimistic_write' },
  });
  if (!latest) throw new NotFoundException('No submission to review');

  const now = new Date();

  // owner_reopen / admin_start_revision: leave latest submission review metadata untouched
  void cause;

  assignment.status = 'changes_requested';
  assignment.reviewedAt = null;
  await manager.getRepository(QuestionnaireAssignment).save(assignment);

  await supersedePendingForSubmission(manager, latest.id, now);

  return { submission: latest, assignment };
}

export function toSubmissionSummaryDto(submission: QuestionnaireSubmission) {
  return {
    id: submission.id,
    submissionNumber: submission.submissionNumber,
    submittedAt: submission.submittedAt.toISOString(),
    reviewStatus: submission.reviewStatus,
    reviewedAt: submission.reviewedAt?.toISOString() ?? null,
    reviewComment: submission.reviewComment,
    reviewedByUserId: submission.reviewedByUserId,
    changeRequestResolution: submission.changeRequestResolution,
    context: parseAssignmentContext(submission.contextJson, {
      submissionId: submission.id,
    }),
  };
}
