import { PermissionService } from '../../platform/permissions/permission.service';
import { UserRole } from '../../platform/identity/user.enums';
import { AbsenceRequestStatus } from './absence.enums';
import { pwPermissions } from './pw-permissions';
import type { User } from '../../platform/identity/user.entity';
import type { Employee } from '../../organization/employees/employee.entity';
import type { AbsenceRequest } from './absence-request.entity';

describe('pwPermissions', () => {
  const permissions = new PermissionService();

  const manager = {
    id: 'u-mgr',
    role: UserRole.DepartmentManager,
  } as User;

  const owner = {
    id: 'u-emp',
    role: UserRole.Employee,
  } as User;

  const employee = {
    id: 'e1',
    userId: 'u-emp',
  } as Employee;

  const pending = {
    status: AbsenceRequestStatus.Pending,
    createdByUserId: 'u-emp',
  } as AbsenceRequest;

  const approved = {
    status: AbsenceRequestStatus.Approved,
    createdByUserId: 'u-emp',
  } as AbsenceRequest;

  it('manager can approve pending for others', () => {
    const caps = pwPermissions(manager, pending, employee, permissions);
    expect(caps.canApprove).toBe(true);
    expect(caps.canReject).toBe(true);
  });

  it('owner can edit/cancel pending', () => {
    const caps = pwPermissions(owner, pending, employee, permissions);
    expect(caps.canEdit).toBe(true);
    expect(caps.canDelete).toBe(true);
    expect(caps.canApprove).toBe(false);
  });

  it('manager can adjust approved for others', () => {
    const caps = pwPermissions(manager, approved, employee, permissions);
    expect(caps.canAdjust).toBe(true);
  });
});
