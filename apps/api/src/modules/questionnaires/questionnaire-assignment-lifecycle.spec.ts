import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { QuestionnaireAssignmentService } from './questionnaire-assignment.service';
import { QuestionnaireAssignment } from './questionnaire-assignment.entity';
import { QuestionnaireResponse } from './questionnaire-response.entity';
import { QuestionnaireSubmission } from './questionnaire-submission.entity';
import { QuestionnaireProfileProposal } from './questionnaire-profile-proposal.entity';
import { Permission } from '../../platform/permissions/permission.names';
import { UserRole } from '../../platform/identity/user.enums';
import type { User } from '../../platform/identity/user.entity';
import { QUESTIONNAIRE_ASSIGNMENT_AUDIT } from './assignments/questionnaire-assignment-transitions';

function adminActor(): User {
  return { id: 'admin-1', role: UserRole.Admin } as User;
}

function employeeActor(): User {
  return { id: 'emp-user', role: UserRole.Employee } as User;
}

describe('QuestionnaireAssignmentService lifecycle', () => {
  const employee = { id: 'emp-1', userId: 'emp-user' };

  function buildService(opts: {
    status: string;
    reviewedAt?: Date | null;
    hasAssign?: boolean;
    canView?: boolean;
    deleteAffected?: number;
  }) {
    const assignment = {
      id: 'a1',
      employeeId: 'emp-1',
      templateVersionId: 'tv1',
      status: opts.status,
      startedAt: new Date('2026-01-01T00:00:00.000Z'),
      submittedAt: new Date('2026-01-02T00:00:00.000Z'),
      reviewedAt:
        opts.reviewedAt === undefined
          ? new Date('2026-01-03T00:00:00.000Z')
          : opts.reviewedAt,
      dueAt: null,
      assignedByUserId: 'admin-1',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      templateVersion: {
        id: 'tv1',
        version: 1,
        schemaJson: { steps: [] },
        template: { code: 'employee-360', title: '360' },
      },
    } as unknown as QuestionnaireAssignment;

    const deleted: string[] = [];
    const deleteOrder: string[] = [];

    const makeManager = (): EntityManager =>
      ({
        getRepository: (entity: unknown) => {
          if (entity === QuestionnaireAssignment) {
            return {
              createQueryBuilder: () => ({
                setLock: () => ({
                  where: () => ({
                    getOne: async () => assignment,
                  }),
                }),
              }),
              findOne: async () => assignment,
              save: async (row: QuestionnaireAssignment) => {
                Object.assign(assignment, row);
                return assignment;
              },
              delete: async (id: string) => {
                deleteOrder.push('delete');
                deleted.push(id);
                return { affected: opts.deleteAffected ?? 1 };
              },
            };
          }
          if (entity === QuestionnaireResponse) {
            return {
              findOne: async () => ({
                id: 'r1',
                assignmentId: 'a1',
                answersJson: {},
                revision: 2,
              }),
            };
          }
          if (entity === QuestionnaireSubmission) {
            return {
              count: async () => 2,
              find: async () => [{ id: 's1' }, { id: 's2' }],
              findOne: async () => null,
            };
          }
          if (entity === QuestionnaireProfileProposal) {
            const chain: {
              innerJoin: jest.Mock;
              where: jest.Mock;
              andWhere: jest.Mock;
              getMany: jest.Mock;
              getCount: jest.Mock;
            } = {
              innerJoin: jest.fn(() => chain),
              where: jest.fn(() => chain),
              andWhere: jest.fn(() => chain),
              getMany: jest.fn(async () => [
                {
                  id: 'p1',
                  status: 'pending',
                  reviewedByUserId: null,
                  reviewedAt: null,
                },
              ]),
              getCount: jest.fn(async () => 3),
            };
            return {
              createQueryBuilder: () => chain,
              save: jest.fn(async (rows: unknown) => rows),
            };
          }
          return {};
        },
      }) as unknown as EntityManager;

    const dataSource = {
      transaction: jest.fn(async (work: (m: EntityManager) => Promise<unknown>) =>
        work(makeManager()),
      ),
    } as unknown as DataSource;

    const audit = {
      record: jest.fn(async (input: { action: string }) => {
        deleteOrder.push('audit');
        return input;
      }),
    };

    const permissions = {
      has: jest.fn((_role: string, perm: string) => {
        if (opts.hasAssign === false) return false;
        if (perm === Permission.QuestionnairesAssign) return true;
        return true;
      }),
    };

    const access = {
      getEmployeeOrFail: jest.fn(async () => employee),
      requireCanView: jest.fn(async () => {
        if (opts.canView === false) {
          throw new ForbiddenException('out of scope');
        }
      }),
      isOwner: jest.fn(() => false),
      isAdmin: jest.fn(() => true),
    };

    const service = new QuestionnaireAssignmentService(
      {} as never,
      {} as never,
      {} as never,
      {
        findOne: jest.fn(async () => ({
          id: 'r1',
          answersJson: {},
          revision: 2,
          updatedAt: new Date(),
        })),
      } as never,
      { find: jest.fn(async () => []), findOne: jest.fn() } as never,
      access as never,
      {} as never,
      permissions as never,
      { ensureResponse: jest.fn() } as never,
      audit as never,
      dataSource,
    );

    jest.spyOn(service, 'getDetail').mockResolvedValue({
      id: 'a1',
      status: assignment.status,
      employeeId: assignment.employeeId,
    } as never);

    return { service, assignment, deleted, deleteOrder, audit, access };
  }

  it.each([
    'assigned',
    'in_progress',
    'submitted',
    'changes_requested',
    'reviewed',
  ] as const)('cancels from %s', async (status) => {
    const ctx = buildService({ status });
    await ctx.service.cancel(adminActor(), 'a1');
    expect(ctx.assignment.status).toBe('cancelled');
    expect(ctx.audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: QUESTIONNAIRE_ASSIGNMENT_AUDIT.cancelled,
      }),
      expect.anything(),
    );
  });

  it('rejects cancel when already cancelled', async () => {
    const ctx = buildService({ status: 'cancelled' });
    await expect(ctx.service.cancel(adminActor(), 'a1')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('reactivates only from cancelled and clears reviewedAt', async () => {
    const ctx = buildService({
      status: 'cancelled',
      reviewedAt: new Date('2026-01-03T00:00:00.000Z'),
    });
    const { employeeId, templateVersionId, startedAt, submittedAt } =
      ctx.assignment;
    await ctx.service.reactivate(adminActor(), 'a1');
    expect(ctx.assignment.status).toBe('assigned');
    expect(ctx.assignment.reviewedAt).toBeNull();
    expect(ctx.assignment.employeeId).toBe(employeeId);
    expect(ctx.assignment.templateVersionId).toBe(templateVersionId);
    expect(ctx.assignment.startedAt).toEqual(startedAt);
    expect(ctx.assignment.submittedAt).toEqual(submittedAt);
    expect(ctx.audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: QUESTIONNAIRE_ASSIGNMENT_AUDIT.reactivated,
      }),
      expect.anything(),
    );
  });

  it('rejects reactivate from non-cancelled', async () => {
    const ctx = buildService({ status: 'assigned' });
    await expect(
      ctx.service.reactivate(adminActor(), 'a1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('allows reactivate without uniqueness check against other actives', async () => {
    const ctx = buildService({ status: 'cancelled' });
    await expect(
      ctx.service.reactivate(adminActor(), 'a1'),
    ).resolves.toBeTruthy();
    expect(ctx.assignment.status).toBe('assigned');
  });

  it('forbids lifecycle without QuestionnairesAssign', async () => {
    const ctx = buildService({ status: 'assigned', hasAssign: false });
    await expect(
      ctx.service.cancel(employeeActor(), 'a1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('forbids lifecycle when employee out of scope', async () => {
    const ctx = buildService({ status: 'assigned', canView: false });
    await expect(ctx.service.cancel(adminActor(), 'a1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('audits before hard delete', async () => {
    const ctx = buildService({ status: 'reviewed' });
    await ctx.service.deleteAssignment(adminActor(), 'a1');
    expect(ctx.deleteOrder[0]).toBe('audit');
    expect(ctx.deleteOrder).toContain('delete');
    expect(ctx.deleted).toEqual(['a1']);
    expect(ctx.audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: QUESTIONNAIRE_ASSIGNMENT_AUDIT.deleted,
        metadata: expect.objectContaining({
          assignmentId: 'a1',
          employeeId: 'emp-1',
          submissionCount: 2,
          proposalCount: 3,
        }),
      }),
      expect.anything(),
    );
  });

  it('throws NotFound when delete affected is not 1', async () => {
    const ctx = buildService({ status: 'assigned', deleteAffected: 0 });
    await expect(
      ctx.service.deleteAssignment(adminActor(), 'a1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
