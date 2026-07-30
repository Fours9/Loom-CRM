import { EntityManager } from 'typeorm';
import {
  supersedePendingForAssignment,
  supersedePendingForSubmission,
} from './questionnaire-proposal-lifecycle';
import { QuestionnaireProfileProposal } from '../questionnaire-profile-proposal.entity';

describe('supersedePendingForAssignment', () => {
  it('supersedes pending across all submissions for the assignment', async () => {
    const now = new Date('2026-07-30T12:00:00.000Z');
    const pendingOld = {
      id: 'p-old',
      status: 'pending',
      reviewedByUserId: 'u',
      reviewedAt: null,
    };
    const pendingNew = {
      id: 'p-new',
      status: 'pending',
      reviewedByUserId: null,
      reviewedAt: null,
    };
    const accepted = {
      id: 'p-acc',
      status: 'accepted',
      reviewedByUserId: 'u',
      reviewedAt: now,
    };

    const save = jest.fn(async (rows: typeof pendingOld[]) => rows);
    const getMany = jest.fn(async () => [pendingOld, pendingNew]);
    const qb = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany,
    };

    const manager = {
      getRepository: jest.fn(() => ({
        createQueryBuilder: jest.fn(() => qb),
        save,
        find: jest.fn(),
      })),
    } as unknown as EntityManager;

    const count = await supersedePendingForAssignment(
      manager,
      'assign-1',
      now,
    );

    expect(count).toBe(2);
    expect(pendingOld.status).toBe('superseded');
    expect(pendingNew.status).toBe('superseded');
    expect(pendingOld.reviewedByUserId).toBeNull();
    expect(pendingOld.reviewedAt).toBe(now);
    expect(save).toHaveBeenCalledWith([pendingOld, pendingNew]);
    expect(accepted.status).toBe('accepted');
    expect(manager.getRepository).toHaveBeenCalledWith(
      QuestionnaireProfileProposal,
    );
  });

  it('leaves accepted/rejected untouched when none pending', async () => {
    const manager = {
      getRepository: jest.fn(() => ({
        createQueryBuilder: jest.fn(() => ({
          innerJoin: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          getMany: jest.fn(async () => []),
        })),
        save: jest.fn(),
      })),
    } as unknown as EntityManager;

    const count = await supersedePendingForAssignment(manager, 'assign-1');
    expect(count).toBe(0);
  });
});

describe('supersedePendingForSubmission', () => {
  it('still scopes by single submissionId', async () => {
    const pending = {
      id: 'p1',
      status: 'pending',
      reviewedByUserId: null,
      reviewedAt: null,
    };
    const find = jest.fn(async () => [pending]);
    const save = jest.fn(async (rows: typeof pending[]) => rows);
    const manager = {
      getRepository: jest.fn(() => ({ find, save })),
    } as unknown as EntityManager;

    await supersedePendingForSubmission(manager, 'sub-1');
    expect(find).toHaveBeenCalledWith({
      where: { submissionId: 'sub-1', status: 'pending' },
    });
    expect(pending.status).toBe('superseded');
  });
});
