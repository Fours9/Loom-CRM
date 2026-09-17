import {
  canCancelAssignment,
  canCloseAssignment,
  canStartRevisionFromState,
} from './questionnaire-assignment-transitions';
import { attachmentStateForStatus } from './questionnaire-assignment-attachment-state';
import { createdAtRangeBounds } from './questionnaire-assignment-list.query';
import {
  computeDetailCapabilities,
  computeListLifecycleCapabilities,
  computeCanStartFill,
  canActorAccessAssignmentTemplate,
  applyGrantedTemplateCodeFilter,
  canManageQuestionnaires,
} from './questionnaire-assignment-access';
import { Permission } from '../../../platform/permissions/permission.names';
import { UserRole } from '../../../platform/identity/user.enums';
import type { User } from '../../../platform/identity/user.entity';
import type { Employee } from '../../../organization/employees/employee.entity';
import type { EmployeeAccessService } from '../../../organization/access/employee-access.service';
import type { AuthorizationContext } from '../../../platform/access-control/authorization-context';

function authzFixture(input: {
  permissions?: Permission[];
  questionnaireTemplateCodes?: string[];
  isAdminEquivalent?: boolean;
  userId?: string;
}): AuthorizationContext {
  return {
    userId: input.userId ?? 'u1',
    accountRole: {
      id: 'role-1',
      code: null,
      name: 'Test',
      permissionPreset: 'employee',
      isAdminEquivalent: input.isAdminEquivalent ?? false,
      isSystem: false,
    },
    permissions: input.permissions ?? [],
    surfaces: [],
    isAdminEquivalent: input.isAdminEquivalent ?? false,
    questionnaireTemplateCodes: input.questionnaireTemplateCodes ?? [],
  };
}

function adminQuestionnairePermissions(): Permission[] {
  return [
    Permission.QuestionnairesCompleteSelf,
    Permission.QuestionnairesCompleteAny,
    Permission.QuestionnairesAssign,
    Permission.QuestionnairesManageLifecycle,
    Permission.QuestionnairesDelete,
    Permission.QuestionnairesReview,
  ];
}

function employeeQuestionnairePermissions(): Permission[] {
  return [Permission.QuestionnairesCompleteSelf];
}

function dmQuestionnairePermissions(extra: Permission[] = []): Permission[] {
  return [
    Permission.QuestionnairesCompleteSelf,
    Permission.QuestionnairesAssign,
    ...extra,
  ];
}

function authzForRole(role: UserRole): AuthorizationContext {
  return authzFixture({
    permissions:
      role === UserRole.Admin
        ? adminQuestionnairePermissions()
        : role === UserRole.DepartmentManager
          ? dmQuestionnairePermissions()
          : employeeQuestionnairePermissions(),
  });
}

function listLifecycle(
  input: Omit<
    Parameters<typeof computeListLifecycleCapabilities>[0],
    'employee' | 'access' | 'hasLatestSubmission'
  > & {
    employee?: Employee | null;
    access?: EmployeeAccessService;
    hasLatestSubmission?: boolean;
  },
) {
  return computeListLifecycleCapabilities({
    employee: { id: 'e1', userId: 'u1' } as Employee,
    access: { isOwner: () => false } as unknown as EmployeeAccessService,
    hasLatestSubmission: false,
    ...input,
  });
}

describe('attachmentStateForStatus', () => {
  it('maps closed / cancelled / new / other', () => {
    expect(attachmentStateForStatus('closed')).toBe('closed');
    expect(attachmentStateForStatus('cancelled')).toBe('detached');
    expect(attachmentStateForStatus('new')).toBe('new');
    expect(attachmentStateForStatus('submitted')).toBe('attached');
  });
});

describe('createdAtRangeBounds', () => {
  it('uses inclusive from and exclusive next-day to', () => {
    const r = createdAtRangeBounds({
      createdFrom: '2026-07-01',
      createdTo: '2026-07-02',
    });
    expect(r.fromStart?.toISOString()).toBe('2026-07-01T00:00:00.000Z');
    expect(r.toExclusive?.toISOString()).toBe('2026-07-03T00:00:00.000Z');
  });
});

describe('close/cancel transitions', () => {
  it('can close cancelled but not closed; can cancel closed (post-submit detach)', () => {
    expect(canCloseAssignment('cancelled')).toBe(true);
    expect(canCloseAssignment('closed')).toBe(false);
    expect(canCancelAssignment('closed')).toBe(true);
  });
});

describe('computeDetailCapabilities matrix', () => {
  function access(isOwner: boolean): EmployeeAccessService {
    return {
      isOwner: () => isOwner,
    } as unknown as EmployeeAccessService;
  }

  const actor = { id: 'u1', role: UserRole.Admin } as User;
  const employee = { id: 'e1' } as Employee;

  it('new assignment: admin with Assign+CompleteAny can edit draft, but cannot submit', () => {
    const adminCaps = computeDetailCapabilities({
      actor,
      employee: null,
      status: 'new',
      authz: authzForRole(UserRole.Admin),
      access: access(false),
    });
    expect(adminCaps.canEditDraft).toBe(true);
    expect(adminCaps.canSubmit).toBe(false);
    expect(adminCaps.canDelete).toBe(true);
  });

  it('new assignment: non-manage actor cannot edit draft', () => {
    const caps = computeDetailCapabilities({
      actor: { id: 'u1', role: UserRole.Employee } as User,
      employee: null,
      status: 'new',
      authz: authzForRole(UserRole.Employee),
      access: access(false),
    });
    expect(caps.canEditDraft).toBe(false);
    expect(caps.canDelete).toBe(false);
  });

  it('cancelled (unattached) is read-only for everyone', () => {
    const adminCaps = computeDetailCapabilities({
      actor,
      employee: null,
      status: 'cancelled',
      authz: authzForRole(UserRole.Admin),
      access: access(false),
    });
    expect(adminCaps.canEditDraft).toBe(false);
    expect(adminCaps.canSubmit).toBe(false);
    expect(adminCaps.canDelete).toBe(true);

    const ownerCaps = computeDetailCapabilities({
      actor: { id: 'u1', role: UserRole.Employee } as User,
      employee,
      status: 'cancelled',
      authz: authzForRole(UserRole.Employee),
      access: access(true),
    });
    expect(ownerCaps.canEditDraft).toBe(false);
    expect(ownerCaps.canDelete).toBe(false);
  });

  it('closed without submission blocks revision/review (manual close)', () => {
    const caps = computeDetailCapabilities({
      actor,
      employee,
      status: 'closed',
      authz: authzForRole(UserRole.Admin),
      access: access(true),
      latestSubmission: null,
    });
    expect(caps).toEqual({
      canEditDraft: false,
      canSubmit: false,
      canReopenSelf: false,
      canStartRevision: false,
      canRequestChanges: false,
      canReview: false,
      canResolveChangeRequest: false,
      canDelete: true,
    });
  });

  it('closed + pending latest: canReview and canRequestChanges', () => {
    const pending = {
      reviewStatus: 'pending',
      reviewComment: null,
      reviewedByUserId: null,
      changeRequestResolution: null,
    };
    const reviewer = computeDetailCapabilities({
      actor: { id: 'u2', role: UserRole.Admin } as User,
      employee,
      status: 'closed',
      authz: authzForRole(UserRole.Admin),
      access: access(false),
      latestSubmission: pending,
    });
    expect(reviewer.canReview).toBe(true);
    expect(reviewer.canRequestChanges).toBe(true);
    expect(reviewer.canStartRevision).toBe(true);
  });

  it('closed + approved latest: !canReview but canRequestChanges', () => {
    const approved = {
      reviewStatus: 'approved',
      reviewComment: null,
      reviewedByUserId: 'u2',
      changeRequestResolution: null,
    };
    const caps = computeDetailCapabilities({
      actor: { id: 'u2', role: UserRole.Admin } as User,
      employee,
      status: 'closed',
      authz: authzForRole(UserRole.Admin),
      access: access(false),
      latestSubmission: approved,
    });
    expect(caps.canReview).toBe(false);
    expect(caps.canRequestChanges).toBe(true);
  });

  it('closed + declined resolution still revision-eligible', () => {
    const declined = {
      reviewStatus: 'changes_requested',
      reviewComment: 'fix',
      reviewedByUserId: 'u2',
      changeRequestResolution: 'declined' as const,
    };
    const caps = computeDetailCapabilities({
      actor: { id: 'u2', role: UserRole.Admin } as User,
      employee,
      status: 'closed',
      authz: authzForRole(UserRole.Admin),
      access: access(false),
      latestSubmission: declined,
    });
    expect(caps.canRequestChanges).toBe(true);
    expect(caps.canReview).toBe(false);
  });

  it('canRequestChanges requires review + revision state + !canEditDraft', () => {
    const pending = {
      reviewStatus: 'pending',
      reviewComment: null,
      reviewedByUserId: null,
      changeRequestResolution: null,
    };
    const reviewer = computeDetailCapabilities({
      actor: { id: 'u2', role: UserRole.Admin } as User,
      employee,
      status: 'closed',
      authz: authzForRole(UserRole.Admin),
      access: access(false),
      latestSubmission: pending,
    });
    expect(reviewer.canEditDraft).toBe(false);
    expect(reviewer.canRequestChanges).toBe(true);

    const ownerEditing = computeDetailCapabilities({
      actor: { id: 'u1', role: UserRole.Employee } as User,
      employee,
      status: 'changes_requested',
      authz: authzForRole(UserRole.Employee),
      access: access(true),
      latestSubmission: {
        reviewStatus: 'changes_requested',
        reviewComment: 'fix dates',
        reviewedByUserId: 'u2',
        changeRequestResolution: null,
      },
    });
    expect(ownerEditing.canEditDraft).toBe(true);
    expect(ownerEditing.canRequestChanges).toBe(false);
    expect(ownerEditing.canResolveChangeRequest).toBe(true);
  });

  it('separates canReopenSelf and canStartRevision', () => {
    const pending = {
      reviewStatus: 'pending',
      reviewComment: null,
      reviewedByUserId: null,
      changeRequestResolution: null,
    };
    const owner = computeDetailCapabilities({
      actor: { id: 'u1', role: UserRole.Employee } as User,
      employee,
      status: 'closed',
      authz: authzForRole(UserRole.Employee),
      access: access(true),
      latestSubmission: pending,
    });
    expect(owner.canReopenSelf).toBe(true);
    expect(owner.canStartRevision).toBe(false);

    const admin = computeDetailCapabilities({
      actor,
      employee,
      status: 'closed',
      authz: authzForRole(UserRole.Admin),
      access: access(false),
      latestSubmission: pending,
    });
    expect(admin.canReopenSelf).toBe(false);
    expect(admin.canStartRevision).toBe(true);
    expect(
      canStartRevisionFromState({
        status: 'closed',
        latestSubmission: pending,
      }),
    ).toBe(true);
    expect(
      canStartRevisionFromState({
        status: 'closed',
        latestSubmission: null,
      }),
    ).toBe(false);
  });

  it('closed list caps allow open + delete + cancel (detach), not close/attach', () => {
    const caps = listLifecycle({
      actor,
      status: 'closed',
      employeeId: 'e1',
      detachedFromEmployeeId: null,
      authz: authzForRole(UserRole.Admin),
    });
    expect(caps.canDelete).toBe(true);
    expect(caps.canOpen).toBe(true);
    expect(caps.canCancel).toBe(true);
    expect(caps.canClose).toBe(false);
    expect(caps.canAttach).toBe(false);
  });

  it('new list caps allow attach, not cancel/close', () => {
    const caps = listLifecycle({
      actor,
      status: 'new',
      employeeId: null,
      detachedFromEmployeeId: null,
      authz: authzForRole(UserRole.Admin),
    });
    expect(caps.canAttach).toBe(true);
    expect(caps.canCancel).toBe(false);
    expect(caps.canClose).toBe(false);
  });

  it('cancelled (unattached) list caps allow attach and close, not cancel', () => {
    const caps = listLifecycle({
      actor,
      status: 'cancelled',
      employeeId: null,
      detachedFromEmployeeId: 'e1',
      authz: authzForRole(UserRole.Admin),
    });
    expect(caps.canAttach).toBe(true);
    expect(caps.canCancel).toBe(false);
    expect(caps.canClose).toBe(true);
  });

  it('non-manage actor never gets canAttach even when statuses allow it', () => {
    const caps = listLifecycle({
      actor: { id: 'u1', role: UserRole.Employee } as User,
      status: 'new',
      employeeId: null,
      detachedFromEmployeeId: null,
      authz: authzForRole(UserRole.Employee),
    });
    expect(caps.canAttach).toBe(false);
  });

  it('Assign-only (DM): can attach new, cannot cancel/close/delete/reattach', () => {
    const assignOnlyAuthz = authzFixture({
      permissions: [Permission.QuestionnairesAssign],
    });

    const neu = listLifecycle({
      actor: { id: 'u1', role: UserRole.DepartmentManager } as User,
      status: 'new',
      employeeId: null,
      detachedFromEmployeeId: null,
      authz: assignOnlyAuthz,
    });
    expect(neu.canAttach).toBe(true);
    expect(neu.canCancel).toBe(false);
    expect(neu.canClose).toBe(false);
    expect(neu.canDelete).toBe(false);

    const cancelled = listLifecycle({
      actor: { id: 'u1', role: UserRole.DepartmentManager } as User,
      status: 'cancelled',
      employeeId: null,
      detachedFromEmployeeId: 'e1',
      authz: assignOnlyAuthz,
    });
    expect(cancelled.canAttach).toBe(false);
    expect(cancelled.canClose).toBe(false);

    const assigned = listLifecycle({
      actor: { id: 'u1', role: UserRole.DepartmentManager } as User,
      status: 'assigned',
      employeeId: 'e1',
      detachedFromEmployeeId: null,
      authz: assignOnlyAuthz,
    });
    expect(assigned.canCancel).toBe(false);
  });
});

describe('canActorAccessAssignmentTemplate', () => {
  it('returns true when template code is granted', () => {
    expect(
      canActorAccessAssignmentTemplate({
        authz: authzFixture({
          questionnaireTemplateCodes: ['employee-360'],
        }),
        templateCode: 'employee-360',
      }),
    ).toBe(true);
  });

  it('returns false when template code is not granted', () => {
    expect(
      canActorAccessAssignmentTemplate({
        authz: authzFixture({
          questionnaireTemplateCodes: ['other-template'],
        }),
        templateCode: 'employee-360',
      }),
    ).toBe(false);
  });

  it('admin equivalent bypasses template grants', () => {
    expect(
      canActorAccessAssignmentTemplate({
        authz: authzFixture({
          isAdminEquivalent: true,
          questionnaireTemplateCodes: [],
        }),
        templateCode: 'any-template',
      }),
    ).toBe(true);
  });
});

describe('applyGrantedTemplateCodeFilter', () => {
  it('uses 1=0 when codes are empty (non-adminEq)', () => {
    const clauses: string[] = [];
    const qb = {
      andWhere: (sql: string) => {
        clauses.push(sql);
        return qb;
      },
    } as never;
    applyGrantedTemplateCodeFilter(
      qb,
      authzFixture({ questionnaireTemplateCodes: [] }),
    );
    expect(clauses).toEqual(['1 = 0']);
  });

  it('skips filter for adminEq', () => {
    const clauses: string[] = [];
    const qb = {
      andWhere: (sql: string) => {
        clauses.push(sql);
        return qb;
      },
    } as never;
    applyGrantedTemplateCodeFilter(
      qb,
      authzFixture({
        isAdminEquivalent: true,
        questionnaireTemplateCodes: [],
      }),
    );
    expect(clauses).toEqual([]);
  });
});

describe('canDelete detail/list matrix', () => {
  function access(isOwner: boolean): EmployeeAccessService {
    return {
      isOwner: () => isOwner,
    } as unknown as EmployeeAccessService;
  }

  const employee = { id: 'e1' } as Employee;

  it('Admin + Assign → detail canDelete true', () => {
    const caps = computeDetailCapabilities({
      actor: { id: 'u1', role: UserRole.Admin } as User,
      employee,
      status: 'assigned',
      authz: authzForRole(UserRole.Admin),
      access: access(false),
    });
    expect(caps.canDelete).toBe(true);
  });

  it('owner employee → detail canDelete false', () => {
    const caps = computeDetailCapabilities({
      actor: { id: 'u1', role: UserRole.Employee } as User,
      employee,
      status: 'assigned',
      authz: authzForRole(UserRole.Employee),
      access: access(true),
    });
    expect(caps.canDelete).toBe(false);
  });

  it('manager in scope → detail canDelete false', () => {
    const caps = computeDetailCapabilities({
      actor: { id: 'u1', role: UserRole.DepartmentManager } as User,
      employee,
      status: 'assigned',
      authz: authzForRole(UserRole.DepartmentManager),
      access: access(false),
    });
    expect(caps.canDelete).toBe(false);
  });

  it('Admin-owner + Assign → detail canDelete true', () => {
    const caps = computeDetailCapabilities({
      actor: { id: 'u1', role: UserRole.Admin } as User,
      employee,
      status: 'assigned',
      authz: authzForRole(UserRole.Admin),
      access: access(true),
    });
    expect(caps.canDelete).toBe(true);
  });

  it('closed + employee owner → detail canDelete false', () => {
    const caps = computeDetailCapabilities({
      actor: { id: 'u1', role: UserRole.Employee } as User,
      employee,
      status: 'closed',
      authz: authzForRole(UserRole.Employee),
      access: access(true),
    });
    expect(caps.canDelete).toBe(false);
  });

  it('list caps: owner canOpen does not imply canDelete', () => {
    const caps = listLifecycle({
      actor: { id: 'u1', role: UserRole.Employee } as User,
      status: 'assigned',
      employeeId: 'e1',
      detachedFromEmployeeId: null,
      authz: authzForRole(UserRole.Employee),
    });
    expect(caps.canOpen).toBe(true);
    expect(caps.canDelete).toBe(false);
  });
});

describe('computeCanStartFill', () => {
  const employee = { id: 'e1', userId: 'u1' } as Employee;
  const ownerAccess = {
    isOwner: () => true,
  } as unknown as EmployeeAccessService;
  const otherAccess = {
    isOwner: () => false,
  } as unknown as EmployeeAccessService;

  it('owner + assigned + no submission → true', () => {
    expect(
      computeCanStartFill({
        actor: { id: 'u1', role: UserRole.Employee } as User,
        employee,
        status: 'assigned',
        authz: authzForRole(UserRole.Employee),
        access: ownerAccess,
        hasLatestSubmission: false,
      }),
    ).toBe(true);
  });

  it('owner + in_progress + no submission → true', () => {
    expect(
      computeCanStartFill({
        actor: { id: 'u1', role: UserRole.Employee } as User,
        employee,
        status: 'in_progress',
        authz: authzForRole(UserRole.Employee),
        access: ownerAccess,
        hasLatestSubmission: false,
      }),
    ).toBe(true);
  });

  it('reattach assigned with submission → false', () => {
    expect(
      computeCanStartFill({
        actor: { id: 'u1', role: UserRole.Employee } as User,
        employee,
        status: 'assigned',
        authz: authzForRole(UserRole.Employee),
        access: ownerAccess,
        hasLatestSubmission: true,
      }),
    ).toBe(false);
  });

  it('non-owner without CompleteAny → false', () => {
    expect(
      computeCanStartFill({
        actor: { id: 'u2', role: UserRole.Employee } as User,
        employee,
        status: 'assigned',
        authz: authzForRole(UserRole.Employee),
        access: otherAccess,
        hasLatestSubmission: false,
      }),
    ).toBe(false);
  });

  it('Admin CompleteAny + assigned + no submission → true', () => {
    expect(
      computeCanStartFill({
        actor: { id: 'u2', role: UserRole.Admin } as User,
        employee,
        status: 'assigned',
        authz: authzForRole(UserRole.Admin),
        access: otherAccess,
        hasLatestSubmission: false,
      }),
    ).toBe(true);
  });

  it('changes_requested → false', () => {
    expect(
      computeCanStartFill({
        actor: { id: 'u1', role: UserRole.Employee } as User,
        employee,
        status: 'changes_requested',
        authz: authzForRole(UserRole.Employee),
        access: ownerAccess,
        hasLatestSubmission: true,
      }),
    ).toBe(false);
  });
});

describe('canManageQuestionnaires', () => {
  it('requires lifecycle ∧ delete ∧ apply', () => {
    expect(
      canManageQuestionnaires(
        authzFixture({
          permissions: [
            Permission.QuestionnairesManageLifecycle,
            Permission.QuestionnairesDelete,
          ],
        }),
      ),
    ).toBe(false);
    expect(
      canManageQuestionnaires(
        authzFixture({
          permissions: [
            Permission.QuestionnairesManageLifecycle,
            Permission.QuestionnairesDelete,
            Permission.QuestionnairesApplyProfileChanges,
          ],
        }),
      ),
    ).toBe(true);
  });

  it('adminEq bypasses', () => {
    expect(
      canManageQuestionnaires(authzFixture({ isAdminEquivalent: true })),
    ).toBe(true);
  });
});
