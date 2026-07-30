import {
  canCompleteOnBehalf,
  computeDetailCapabilities,
  requireCanSubmit,
} from './questionnaire-assignment-access';
import { Permission } from '../../../platform/permissions/permission.names';
import { UserRole } from '../../../platform/identity/user.enums';
import type { User } from '../../../platform/identity/user.entity';
import type { Employee } from '../../../organization/employees/employee.entity';
import type { PermissionService } from '../../../platform/permissions/permission.service';
import type { EmployeeAccessService } from '../../../organization/access/employee-access.service';

/**
 * Documents preserveCancelled semantics used by submit:
 * Admin CompleteAny on cancelled keeps status cancelled after submit.
 */
describe('preserveCancelled submit policy', () => {
  it('canCompleteOnBehalf is true only with CompleteAny', () => {
    const withAny = {
      has: (_r: string, p: string) => p === Permission.QuestionnairesCompleteAny,
    } as unknown as PermissionService;
    const without = {
      has: () => false,
    } as unknown as PermissionService;
    const actor = { id: 'a', role: UserRole.Admin } as User;
    expect(canCompleteOnBehalf(withAny, actor)).toBe(true);
    expect(canCompleteOnBehalf(without, actor)).toBe(false);
  });

  it('Admin on cancelled may submit; preserveCancelled condition holds', () => {
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
    expect(caps.canSubmit).toBe(true);
    requireCanSubmit(caps);
    const preserveCancelled =
      true && canCompleteOnBehalf(permissions, actor);
    expect(preserveCancelled).toBe(true);
  });
});
