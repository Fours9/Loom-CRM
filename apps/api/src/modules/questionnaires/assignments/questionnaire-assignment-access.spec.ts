import {
  canCancelAssignment,
  canCloseAssignment,
  canReactivateAssignment,
  canStartRevisionFromStatus,
} from './questionnaire-assignment-transitions';
import { attachmentStateForStatus } from './questionnaire-assignment-attachment-state';
import { createdAtRangeBounds } from './questionnaire-assignment-list.query';
import {
  computeDetailCapabilities,
  computeListLifecycleCapabilities,
} from './questionnaire-assignment-access';
import { Permission } from '../../../platform/permissions/permission.names';
import { UserRole } from '../../../platform/identity/user.enums';
import type { User } from '../../../platform/identity/user.entity';
import type { Employee } from '../../../organization/employees/employee.entity';
import type { PermissionService } from '../../../platform/permissions/permission.service';
import type { EmployeeAccessService } from '../../../organization/access/employee-access.service';

describe('attachmentStateForStatus', () => {
  it('maps closed / cancelled / other', () => {
    expect(attachmentStateForStatus('closed')).toBe('closed');
    expect(attachmentStateForStatus('cancelled')).toBe('detached');
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
  it('can close cancelled but not closed', () => {
    expect(canCloseAssignment('cancelled')).toBe(true);
    expect(canCloseAssignment('closed')).toBe(false);
    expect(canCancelAssignment('closed')).toBe(false);
    expect(canReactivateAssignment('closed')).toBe(false);
  });
});

describe('computeDetailCapabilities matrix', () => {
  function perms(role: UserRole): PermissionService {
    const set = new Set<string>(
      role === UserRole.Admin
        ? [
            Permission.QuestionnairesCompleteSelf,
            Permission.QuestionnairesCompleteAny,
            Permission.QuestionnairesAssign,
            Permission.QuestionnairesReview,
          ]
        : [Permission.QuestionnairesCompleteSelf],
    );
    return {
      has: (_r: string, p: string) => set.has(p),
    } as unknown as PermissionService;
  }

  function access(isOwner: boolean): EmployeeAccessService {
    return {
      isOwner: () => isOwner,
    } as unknown as EmployeeAccessService;
  }

  const actor = { id: 'u1', role: UserRole.Admin } as User;
  const employee = { id: 'e1' } as Employee;

  it('Admin can edit cancelled; owner cannot', () => {
    const adminCaps = computeDetailCapabilities({
      actor,
      employee,
      status: 'cancelled',
      permissions: perms(UserRole.Admin),
      access: access(false),
    });
    expect(adminCaps.canEditDraft).toBe(true);
    expect(adminCaps.canSubmit).toBe(true);

    const ownerCaps = computeDetailCapabilities({
      actor: { id: 'u1', role: UserRole.Employee } as User,
      employee,
      status: 'cancelled',
      permissions: perms(UserRole.Employee),
      access: access(true),
    });
    expect(ownerCaps.canEditDraft).toBe(false);
  });

  it('closed blocks all detail mutations', () => {
    const caps = computeDetailCapabilities({
      actor,
      employee,
      status: 'closed',
      permissions: perms(UserRole.Admin),
      access: access(true),
    });
    expect(caps).toEqual({
      canEditDraft: false,
      canSubmit: false,
      canReopenSelf: false,
      canStartRevision: false,
      canRequestChanges: false,
      canReview: false,
    });
  });

  it('separates canReopenSelf and canStartRevision', () => {
    const owner = computeDetailCapabilities({
      actor: { id: 'u1', role: UserRole.Employee } as User,
      employee,
      status: 'submitted',
      permissions: perms(UserRole.Employee),
      access: access(true),
    });
    expect(owner.canReopenSelf).toBe(true);
    expect(owner.canStartRevision).toBe(false);

    const admin = computeDetailCapabilities({
      actor,
      employee,
      status: 'submitted',
      permissions: perms(UserRole.Admin),
      access: access(false),
    });
    expect(admin.canReopenSelf).toBe(false);
    expect(admin.canStartRevision).toBe(true);
    expect(canStartRevisionFromStatus('submitted')).toBe(true);
  });

  it('closed list caps allow only delete + open', () => {
    const caps = computeListLifecycleCapabilities({
      actor,
      status: 'closed',
      permissions: perms(UserRole.Admin),
    });
    expect(caps.canDelete).toBe(true);
    expect(caps.canOpen).toBe(true);
    expect(caps.canCancel).toBe(false);
    expect(caps.canClose).toBe(false);
    expect(caps.canReactivate).toBe(false);
  });
});
