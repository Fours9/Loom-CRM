import {
  collectChangesRequestedRecipientIds,
  hasActiveReviewerRequest,
} from './questionnaire-active-change-request';

describe('hasActiveReviewerRequest', () => {
  const activeLatest = {
    reviewStatus: 'changes_requested',
    reviewComment: 'Fix dates',
    reviewedByUserId: 'u-reviewer',
    changeRequestResolution: null as 'completed' | 'declined' | null,
  };

  it('is true only for open reviewer request', () => {
    expect(
      hasActiveReviewerRequest({
        assignmentStatus: 'changes_requested',
        latest: activeLatest,
      }),
    ).toBe(true);
  });

  it('is false when resolution is set', () => {
    expect(
      hasActiveReviewerRequest({
        assignmentStatus: 'changes_requested',
        latest: { ...activeLatest, changeRequestResolution: 'declined' },
      }),
    ).toBe(false);
  });

  it('is false when reviewedByUserId is null', () => {
    expect(
      hasActiveReviewerRequest({
        assignmentStatus: 'changes_requested',
        latest: { ...activeLatest, reviewedByUserId: null },
      }),
    ).toBe(false);
  });

  it('is false when comment is blank', () => {
    expect(
      hasActiveReviewerRequest({
        assignmentStatus: 'changes_requested',
        latest: { ...activeLatest, reviewComment: '   ' },
      }),
    ).toBe(false);
  });
});

describe('collectChangesRequestedRecipientIds', () => {
  it('notifies assignedBy when they can edit after transition', () => {
    expect(
      collectChangesRequestedRecipientIds({
        actorId: 'reviewer',
        assignedBy: { id: 'owner' },
        assignedByCanEditDraft: true,
        activeAdminIds: ['admin1', 'admin2'],
      }),
    ).toEqual(['owner']);
  });

  it('fans out to admins when assignedBy cannot edit', () => {
    expect(
      collectChangesRequestedRecipientIds({
        actorId: 'reviewer',
        assignedBy: { id: 'owner' },
        assignedByCanEditDraft: false,
        activeAdminIds: ['admin1', 'owner'],
      }).sort(),
    ).toEqual(['admin1', 'owner']);
  });

  it('yields zero notifications when actor is assignedBy and can edit', () => {
    expect(
      collectChangesRequestedRecipientIds({
        actorId: 'owner',
        assignedBy: { id: 'owner' },
        assignedByCanEditDraft: true,
        activeAdminIds: ['admin1'],
      }),
    ).toEqual([]);
  });

  it('skips self when actor is also an admin recipient', () => {
    expect(
      collectChangesRequestedRecipientIds({
        actorId: 'admin1',
        assignedBy: null,
        assignedByCanEditDraft: false,
        activeAdminIds: ['admin1', 'admin2'],
      }),
    ).toEqual(['admin2']);
  });
});
