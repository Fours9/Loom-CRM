import type { AuthorizationContext } from '../../platform/access-control/authorization-context';
import { Permission } from '../../platform/permissions/permission.names';
import { AbsenceRequestStatus } from './absence.enums';
import { pwPermissions } from './pw-permissions';
import type { Employee } from '../../organization/employees/employee.entity';
import type { AbsenceRequest } from './absence-request.entity';

function authz(partial: {
  userId: string;
  permissions: Permission[];
  isAdminEquivalent?: boolean;
}): AuthorizationContext {
  return {
    userId: partial.userId,
    accountRole: {
      id: 'role',
      code: null,
      name: 'test',
      permissionPreset: 'employee',
      isAdminEquivalent: partial.isAdminEquivalent ?? false,
      isSystem: false,
    },
    permissions: partial.permissions,
    surfaces: [],
    isAdminEquivalent: partial.isAdminEquivalent ?? false,
    questionnaireTemplateCodes: [],
  };
}

describe('pwPermissions', () => {
  const managed = { inManagedSubmissionDepartment: true };
  const unmanaged = { inManagedSubmissionDepartment: false };

  const employee = {
    id: 'e1',
    userId: 'u-emp',
  } as Employee;

  const adminEmployee = {
    id: 'e-admin',
    userId: 'u-admin',
  } as Employee;

  const pending = {
    status: AbsenceRequestStatus.Pending,
    createdByUserId: 'u-emp',
  } as AbsenceRequest;

  const approved = {
    status: AbsenceRequestStatus.Approved,
    createdByUserId: 'u-emp',
  } as AbsenceRequest;

  const managerAuthz = authz({
    userId: 'u-mgr',
    permissions: [Permission.AbsencesApprove, Permission.AbsencesCancel],
  });

  const ownerAuthz = authz({
    userId: 'u-emp',
    permissions: [Permission.AbsencesCreate, Permission.AbsencesCancel],
  });

  const adminEqAuthz = authz({
    userId: 'u-admin',
    permissions: [],
    isAdminEquivalent: true,
  });

  const adminOnlyAuthz = authz({
    userId: 'u-admin-cap',
    permissions: [Permission.AbsencesAdmin],
  });

  it('manager can approve pending for others in managed dept', () => {
    const caps = pwPermissions(managerAuthz, pending, employee, managed);
    expect(caps.canApprove).toBe(true);
    expect(caps.canReject).toBe(true);
  });

  it('manager cannot approve pending outside managed dept', () => {
    const caps = pwPermissions(managerAuthz, pending, employee, unmanaged);
    expect(caps.canApprove).toBe(false);
    expect(caps.canReject).toBe(false);
  });

  it('owner can edit/cancel pending', () => {
    const caps = pwPermissions(ownerAuthz, pending, employee, unmanaged);
    expect(caps.canEdit).toBe(true);
    expect(caps.canDelete).toBe(true);
    expect(caps.canApprove).toBe(false);
  });

  it('manager can adjust approved for others in managed dept', () => {
    const caps = pwPermissions(managerAuthz, approved, employee, managed);
    expect(caps.canAdjust).toBe(true);
  });

  it('adminEq can approve own pending request (solo-admin)', () => {
    const ownPending = {
      status: AbsenceRequestStatus.Pending,
      createdByUserId: 'u-admin',
    } as AbsenceRequest;
    const caps = pwPermissions(
      adminEqAuthz,
      ownPending,
      adminEmployee,
      managed,
    );
    expect(caps.canApprove).toBe(true);
    expect(caps.canReject).toBe(true);
  });

  it('AbsencesAdmin without Approve cannot moderate', () => {
    const caps = pwPermissions(adminOnlyAuthz, pending, employee, managed);
    expect(caps.canApprove).toBe(false);
    expect(caps.canAdjust).toBe(false);
    expect(caps.canEdit).toBe(false);
  });

  it('AbsencesAdmin can finalize deletion', () => {
    const deletion = {
      status: AbsenceRequestStatus.DeletionRequested,
      createdByUserId: 'u-emp',
    } as AbsenceRequest;
    const caps = pwPermissions(adminOnlyAuthz, deletion, employee, managed);
    expect(caps.canApproveDeletion).toBe(true);
    expect(caps.canRejectDeletion).toBe(true);
  });

  it('owner and adminEq can request deletion for cancelled', () => {
    const cancelled = {
      status: AbsenceRequestStatus.Cancelled,
      createdByUserId: 'u-emp',
    } as AbsenceRequest;

    expect(
      pwPermissions(ownerAuthz, cancelled, employee, unmanaged)
        .canRequestDeletion,
    ).toBe(true);
    expect(
      pwPermissions(adminEqAuthz, cancelled, employee, managed)
        .canRequestDeletion,
    ).toBe(true);
    expect(
      pwPermissions(managerAuthz, cancelled, employee, managed)
        .canRequestDeletion,
    ).toBe(true);
  });

  it('submission-dept manager can request deletion for rejected', () => {
    const rejected = {
      status: AbsenceRequestStatus.Rejected,
      createdByUserId: 'u-emp',
    } as AbsenceRequest;

    expect(
      pwPermissions(managerAuthz, rejected, employee, managed)
        .canRequestDeletion,
    ).toBe(true);
    expect(
      pwPermissions(managerAuthz, rejected, employee, unmanaged)
        .canRequestDeletion,
    ).toBe(false);
  });
});
