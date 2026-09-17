import { computeDetailCapabilities, requireCanSubmit } from './questionnaire-assignment-access';
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
}): AuthorizationContext {
  return {
    userId: 'a',
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

/**
 * Cancelled assignments are detached (employeeId null, detachedFromEmployeeId
 * set) and fully read-only: nobody can submit them, regardless of role.
 * Reattaching goes through attach(), which moves the assignment back to
 * 'assigned' before it becomes editable again.
 */
describe('cancelled assignments are read-only for submit', () => {
  it('Admin with CompleteAny cannot submit a cancelled assignment', () => {
    const authz = authzFixture({
      permissions: [
        Permission.QuestionnairesCompleteAny,
        Permission.QuestionnairesCompleteSelf,
      ],
    });
    const access = {
      isOwner: () => false,
    } as unknown as EmployeeAccessService;
    const actor = { id: 'a', role: UserRole.Admin } as User;
    const employee = { id: 'e' } as Employee;
    const caps = computeDetailCapabilities({
      authz,
      actor,
      employee,
      status: 'cancelled',
      access,
    });
    expect(caps.canSubmit).toBe(false);
    expect(() => requireCanSubmit(caps)).toThrow();
  });
});
