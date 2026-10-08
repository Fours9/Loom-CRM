import { Permission } from '../../platform/permissions/permission.names';
import type { AuthorizationContext } from '../../platform/access-control/authorization-context';
import {
  canDeleteEmployee,
  canDestructivelyManageAccount,
  canResetPassword,
} from '../employees/employee-profile-authz';

function authz(partial: {
  isAdminEquivalent?: boolean;
  permissions?: Permission[];
}): AuthorizationContext {
  return {
    userId: 'u1',
    accountRole: {
      id: 'r1',
      code: 'x',
      name: 'X',
      permissionPreset: 'employee',
      isAdminEquivalent: partial.isAdminEquivalent ?? false,
      isSystem: true,
    },
    permissions: partial.permissions ?? [],
    surfaces: [],
    questionnaireTemplateCodes: [],
    isAdminEquivalent: partial.isAdminEquivalent ?? false,
  };
}

describe('account predicates (employee-profile-authz)', () => {
  const admin = authz({ isAdminEquivalent: true });
  const manager = authz({
    permissions: [Permission.EmployeesManageProfiles],
  });

  it('canResetPassword requires adminEq + target account', () => {
    expect(canResetPassword(admin, true)).toBe(true);
    expect(canResetPassword(admin, false)).toBe(false);
    expect(canResetPassword(manager, true)).toBe(false);
  });

  it('canDestructivelyManageAccount bans self', () => {
    expect(canDestructivelyManageAccount(admin, true, false)).toBe(true);
    expect(canDestructivelyManageAccount(admin, true, true)).toBe(false);
  });

  it('canDeleteEmployee bans self; non-adminEq denied', () => {
    expect(canDeleteEmployee(admin, false)).toBe(true);
    expect(canDeleteEmployee(admin, true)).toBe(false);
    expect(canDeleteEmployee(manager, false)).toBe(false);
  });

  it('canDeleteEmployee allows adminEq when target has no account', () => {
    expect(canDeleteEmployee(admin, false)).toBe(true);
  });
});
