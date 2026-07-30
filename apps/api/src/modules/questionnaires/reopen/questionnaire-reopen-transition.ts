import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { QuestionnaireAssignment } from '../questionnaire-assignment.entity';
import { QuestionnaireResponse } from '../questionnaire-response.entity';
import { QuestionnaireSubmission } from '../questionnaire-submission.entity';
import { supersedePendingForSubmission } from '../proposals/questionnaire-proposal-lifecycle';

export type QuestionnaireReopenCause =
  | { kind: 'owner_reopen'; actorUserId: string }
  | { kind: 'admin_start_revision'; actorUserId: string }
  | {
      kind: 'reviewer_request_changes';
      actorUserId: string;
      reviewComment: string | null;
    };

export type ReopenTransitionResult = {
  submission: QuestionnaireSubmission;
  assignment: QuestionnaireAssignment;
};

/**
 * Shared assignment → changes_requested transition.
 * Owner and reviewer side effects differ; both supersede pending on latest submission.
 */
export async function applyReopenTransition(
  manager: EntityManager,
  assignment: QuestionnaireAssignment,
  cause: QuestionnaireReopenCause,
): Promise<ReopenTransitionResult> {
  if (assignment.status !== 'submitted' && assignment.status !== 'reviewed') {
    throw new BadRequestException(
      `Cannot reopen from status ${assignment.status}`,
    );
  }

  const response = await manager.getRepository(QuestionnaireResponse).findOne({
    where: { assignmentId: assignment.id },
  });
  if (!response) throw new NotFoundException('Response not found');

  const latest = await manager.getRepository(QuestionnaireSubmission).findOne({
    where: { responseId: response.id },
    order: { submissionNumber: 'DESC' },
  });
  if (!latest) throw new NotFoundException('No submission to review');

  const now = new Date();

  if (cause.kind === 'reviewer_request_changes') {
    latest.reviewStatus = 'changes_requested';
    latest.reviewedByUserId = cause.actorUserId;
    latest.reviewedAt = now;
    latest.reviewComment = cause.reviewComment?.trim() || null;
    await manager.getRepository(QuestionnaireSubmission).save(latest);
  }
  // owner_reopen / admin_start_revision: leave latest submission review metadata untouched

  assignment.status = 'changes_requested';
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
  };
}
