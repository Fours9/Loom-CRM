import { PermissionService } from '../../platform/permissions/permission.service';
import { UserRole } from '../../platform/identity/user.enums';
import { AbsenceRequestStatus } from './absence.enums';
import { pwPermissions } from './pw-permissions';
import type { User } from '../../platform/identity/user.entity';
import type { Employee } from '../../organization/employees/employee.entity';
import type { AbsenceRequest } from './absence-request.entity';

describe('pwPermissions', () => {
  const permissions = new PermissionService();
  const managed = { canManageSubmissionDepartment: true };
  const unmanaged = { canManageSubmissionDepartment: false };

  const manager = {
    id: 'u-mgr',
    role: UserRole.DepartmentManager,
  } as User;

  const owner = {
    id: 'u-emp',
    role: UserRole.Employee,
  } as User;

  const admin = {
    id: 'u-admin',
    role: UserRole.Admin,
  } as User;

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

  it('manager can approve pending for others in managed dept', () => {
    const caps = pwPermissions(manager, pending, employee, permissions, managed);
    expect(caps.canApprove).toBe(true);
    expect(caps.canReject).toBe(true);
  });

  it('manager cannot approve pending outside managed dept', () => {
    const caps = pwPermissions(
      manager,
      pending,
      employee,
      permissions,
      unmanaged,
    );
    expect(caps.canApprove).toBe(false);
    expect(caps.canReject).toBe(false);
  });

  it('owner can edit/cancel pending', () => {
    const caps = pwPermissions(owner, pending, employee, permissions, unmanaged);
    expect(caps.canEdit).toBe(true);
    expect(caps.canDelete).toBe(true);
    expect(caps.canApprove).toBe(false);
  });

  it('manager can adjust approved for others in managed dept', () => {
    const caps = pwPermissions(manager, approved, employee, permissions, managed);
    expect(caps.canAdjust).toBe(true);
  });

  it('admin can approve own pending request (PW solo-admin)', () => {
    const ownPending = {
      status: AbsenceRequestStatus.Pending,
      createdByUserId: 'u-admin',
    } as AbsenceRequest;
    const caps = pwPermissions(
      admin,
      ownPending,
      adminEmployee,
      permissions,
      managed,
    );
    expect(caps.canApprove).toBe(true);
    expect(caps.canReject).toBe(true);
  });

  it('owner and admin can request deletion for cancelled', () => {
    const cancelled = {
      status: AbsenceRequestStatus.Cancelled,
      createdByUserId: 'u-emp',
    } as AbsenceRequest;

    expect(
      pwPermissions(owner, cancelled, employee, permissions, unmanaged)
        .canRequestDeletion,
    ).toBe(true);
    expect(
      pwPermissions(admin, cancelled, employee, permissions, managed)
        .canRequestDeletion,
    ).toBe(true);
    expect(
      pwPermissions(manager, cancelled, employee, permissions, managed)
        .canRequestDeletion,
    ).toBe(true);
  });

  it('admin and submission-dept manager can request deletion for rejected (PW)', () => {
    const rejected = {
      status: AbsenceRequestStatus.Rejected,
      createdByUserId: 'u-emp',
    } as AbsenceRequest;

    expect(
      pwPermissions(admin, rejected, employee, permissions, managed)
        .canRequestDeletion,
    ).toBe(true);
    expect(
      pwPermissions(manager, rejected, employee, permissions, managed)
        .canRequestDeletion,
    ).toBe(true);
    expect(
      pwPermissions(owner, rejected, employee, permissions, unmanaged)
        .canRequestDeletion,
    ).toBe(true);
    expect(
      pwPermissions(manager, rejected, employee, permissions, unmanaged)
        .canRequestDeletion,
    ).toBe(false);
  });
});
