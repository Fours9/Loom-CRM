import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { isQuestionnairePostSubmitStatus } from '@loom/contracts-questionnaires';
import { QuestionnaireAssignment } from '../questionnaire-assignment.entity';
import { QuestionnaireResponse } from '../questionnaire-response.entity';
import { QuestionnaireSubmission } from '../questionnaire-submission.entity';
import { supersedePendingForSubmission } from '../proposals/questionnaire-proposal-lifecycle';

export type ReviewTransitionInput =
  | {
      kind: 'approve';
      actorUserId: string;
      reviewComment?: string | null;
    }
  | {
      kind: 'request_changes';
      actorUserId: string;
      /** Already trimmed; must be non-empty. */
      reviewComment: string;
    };

export type ReviewTransitionResult = {
  submission: QuestionnaireSubmission;
  assignment: QuestionnaireAssignment;
};

/**
 * Domain-only: approve or request-changes on latest submission.
 * AuthZ belongs in the service layer before entering this TX helper.
 */
export async function applyReviewTransition(
  manager: EntityManager,
  assignmentId: string,
  targetSubmissionId: string,
  input: ReviewTransitionInput,
): Promise<ReviewTransitionResult> {
  const assignment = await manager
    .getRepository(QuestionnaireAssignment)
    .findOne({
      where: { id: assignmentId },
      lock: { mode: 'pessimistic_write' },
    });
  if (!assignment) throw new NotFoundException('Assignment not found');

  if (!isQuestionnairePostSubmitStatus(assignment.status)) {
    throw new BadRequestException(
      `Cannot review from status ${assignment.status}`,
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

  if (latest.id !== targetSubmissionId) {
    throw new ConflictException(
      'Запросити зміни / перевірити можна лише останню версію анкети',
    );
  }

  const now = new Date();

  if (input.kind === 'approve') {
    if (latest.reviewStatus !== 'pending') {
      throw new ConflictException(
        `Cannot approve submission in reviewStatus ${latest.reviewStatus}`,
      );
    }
    latest.reviewStatus = 'approved';
    latest.reviewedByUserId = input.actorUserId;
    latest.reviewedAt = now;
    latest.reviewComment = input.reviewComment?.trim() || null;
    await manager.getRepository(QuestionnaireSubmission).save(latest);

    assignment.status = 'closed';
    assignment.reviewedAt = now;
    await manager.getRepository(QuestionnaireAssignment).save(assignment);

    return { submission: latest, assignment };
  }

  const comment = input.reviewComment?.trim() ?? '';
  if (!comment) {
    throw new BadRequestException('Review comment is required');
  }

  latest.reviewStatus = 'changes_requested';
  latest.reviewedByUserId = input.actorUserId;
  latest.reviewedAt = now;
  latest.reviewComment = comment;
  // Clear prior resolution so a re-request after declined becomes active again.
  latest.changeRequestResolution = null;
  latest.changeRequestResolvedByUserId = null;
  latest.changeRequestResolvedAt = null;
  await manager.getRepository(QuestionnaireSubmission).save(latest);

  assignment.status = 'changes_requested';
  assignment.reviewedAt = null;
  await manager.getRepository(QuestionnaireAssignment).save(assignment);

  await supersedePendingForSubmission(manager, latest.id, now);

  return { submission: latest, assignment };
}
