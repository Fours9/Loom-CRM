import { computeDetailCapabilities, requireCanSubmit } from './questionnaire-assignment-access';
import { Permission } from '../../../platform/permissions/permission.names';
import { UserRole } from '../../../platform/identity/user.enums';
import type { User } from '../../../platform/identity/user.entity';
import type { Employee } from '../../../organization/employees/employee.entity';
import type { PermissionService } from '../../../platform/permissions/permission.service';
import type { EmployeeAccessService } from '../../../organization/access/employee-access.service';

/**
 * Cancelled assignments are detached (employeeId null, detachedFromEmployeeId
 * set) and fully read-only: nobody can submit them, regardless of role.
 * Reattaching goes through attach(), which moves the assignment back to
 * 'assigned' before it becomes editable again.
 */
describe('cancelled assignments are read-only for submit', () => {
  it('Admin with CompleteAny cannot submit a cancelled assignment', () => {
    const permissions = {
      has: (_r: string, p: string) =>
        p === Permission.QuestionnairesCompleteAny ||
        p === Permission.QuestionnairesCompleteSelf,
    } as unknown as PermissionService;
    const access = {
      isOwner: () => false,
    } as unknown as EmployeeAccessService;
    const actor = { id: 'a', role: UserRole.Admin } as User;
    const employee = { id: 'e' } as Employee;
    const caps = computeDetailCapabilities({
      actor,
      employee,
      status: 'cancelled',
      permissions,
      access,
    });
    expect(caps.canSubmit).toBe(false);
    expect(() => requireCanSubmit(caps)).toThrow();
  });
});
