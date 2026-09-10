import { ConflictException } from '@nestjs/common';
import { canStartRevisionFromState } from '../assignments/questionnaire-assignment-transitions';
import { hasActiveReviewerRequest } from './questionnaire-active-change-request';

jest.mock('../proposals/questionnaire-proposal-lifecycle', () => ({
  supersedePendingForSubmission: jest.fn(async () => undefined),
}));

import { applyReviewTransition } from './questionnaire-review-transition';
import { supersedePendingForSubmission } from '../proposals/questionnaire-proposal-lifecycle';

describe('canStartRevisionFromState', () => {
  it('requires post-submit status and latest submission', () => {
    expect(
      canStartRevisionFromState({
        status: 'closed',
        latestSubmission: { id: 's1' },
      }),
    ).toBe(true);
    expect(
      canStartRevisionFromState({
        status: 'closed',
        latestSubmission: null,
      }),
    ).toBe(false);
    expect(
      canStartRevisionFromState({
        status: 'submitted',
        latestSubmission: null,
      }),
    ).toBe(false);
    expect(
      canStartRevisionFromState({
        status: 'in_progress',
        latestSubmission: { id: 's1' },
      }),
    ).toBe(false);
  });
});

function mockManager(opts: {
  assignment: Record<string, unknown>;
  response: Record<string, unknown> | null;
  latest: Record<string, unknown> | null;
}) {
  const savedSubmissions: unknown[] = [];
  const savedAssignments: unknown[] = [];
  return {
    savedSubmissions,
    savedAssignments,
    manager: {
      getRepository: (entity: { name: string }) => {
        switch (entity.name) {
          case 'QuestionnaireAssignment':
            return {
              findOne: async () => opts.assignment,
              save: async (row: unknown) => {
                savedAssignments.push(row);
                return row;
              },
            };
          case 'QuestionnaireResponse':
            return {
              findOne: async () => opts.response,
            };
          case 'QuestionnaireSubmission':
            return {
              findOne: async () => opts.latest,
              save: async (row: unknown) => {
                savedSubmissions.push(row);
                return row;
              },
            };
          default:
            throw new Error(`unexpected ${entity.name}`);
        }
      },
    },
  };
}

describe('applyReviewTransition', () => {
  beforeEach(() => {
    jest.mocked(supersedePendingForSubmission).mockClear();
  });

  it('DoD18: request_changes resets resolution → hasActiveReviewerRequest true', async () => {
    const assignment = {
      id: 'a1',
      status: 'closed',
      reviewedAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    const latest = {
      id: 's2',
      reviewStatus: 'changes_requested',
      reviewComment: 'old',
      reviewedByUserId: 'rev1',
      reviewedAt: new Date('2026-01-02T00:00:00.000Z'),
      changeRequestResolution: 'declined' as const,
      changeRequestResolvedByUserId: 'u1',
      changeRequestResolvedAt: new Date('2026-01-03T00:00:00.000Z'),
    };
    const { manager } = mockManager({
      assignment,
      response: { id: 'r1', assignmentId: 'a1' },
      latest,
    });

    const result = await applyReviewTransition(manager as never, 'a1', 's2', {
      kind: 'request_changes',
      actorUserId: 'rev2',
      reviewComment: 'please fix again',
    });

    expect(result.assignment.status).toBe('changes_requested');
    expect(result.assignment.reviewedAt).toBeNull();
    expect(result.submission.changeRequestResolution).toBeNull();
    expect(result.submission.changeRequestResolvedByUserId).toBeNull();
    expect(result.submission.changeRequestResolvedAt).toBeNull();
    expect(result.submission.reviewComment).toBe('please fix again');
    expect(
      hasActiveReviewerRequest({
        assignmentStatus: result.assignment.status,
        latest: result.submission as never,
      }),
    ).toBe(true);
    expect(supersedePendingForSubmission).toHaveBeenCalled();
  });

  it('DoD19: stale targetSubmissionId → 409; latest untouched', async () => {
    const latest = {
      id: 's3',
      reviewStatus: 'pending',
      reviewComment: null,
      reviewedByUserId: null,
      reviewedAt: null,
      changeRequestResolution: null,
      changeRequestResolvedByUserId: null,
      changeRequestResolvedAt: null,
    };
    const { manager, savedSubmissions, savedAssignments } = mockManager({
      assignment: { id: 'a1', status: 'closed', reviewedAt: null },
      response: { id: 'r1', assignmentId: 'a1' },
      latest,
    });

    await expect(
      applyReviewTransition(manager as never, 'a1', 's2', {
        kind: 'request_changes',
        actorUserId: 'rev',
        reviewComment: 'stale',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(savedSubmissions).toHaveLength(0);
    expect(savedAssignments).toHaveLength(0);
    expect(latest.reviewStatus).toBe('pending');
  });

  it('approve keeps assignment closed and mirrors reviewedAt', async () => {
    const assignment = {
      id: 'a1',
      status: 'closed',
      reviewedAt: null as Date | null,
    };
    const latest = {
      id: 's1',
      reviewStatus: 'pending',
      reviewComment: null,
      reviewedByUserId: null,
      reviewedAt: null as Date | null,
      changeRequestResolution: null,
      changeRequestResolvedByUserId: null,
      changeRequestResolvedAt: null,
    };
    const { manager } = mockManager({
      assignment,
      response: { id: 'r1', assignmentId: 'a1' },
      latest,
    });

    const result = await applyReviewTransition(manager as never, 'a1', 's1', {
      kind: 'approve',
      actorUserId: 'rev',
      reviewComment: 'ok',
    });

    expect(result.assignment.status).toBe('closed');
    expect(result.assignment.reviewedAt).toBeInstanceOf(Date);
    expect(result.submission.reviewStatus).toBe('approved');
    expect(supersedePendingForSubmission).not.toHaveBeenCalled();
  });
});
