import { Permission } from '../../platform/permissions/permission.names';
import type { AuthorizationContext } from '../../platform/access-control/authorization-context';
import { canAssignAccountRole } from './employee-account-role-assign.policy';

function authz(partial: {
  isAdminEquivalent?: boolean;
  permissions?: Permission[];
  userId?: string;
}): AuthorizationContext {
  return {
    userId: partial.userId ?? 'actor-1',
    accountRole: {
      id: 'role-1',
      code: 'employee',
      name: 'Employee',
      permissionPreset: 'employee',
      isAdminEquivalent: partial.isAdminEquivalent ?? false,
      isSystem: true,
    },
    permissions: partial.permissions ?? [],
    surfaces: [],
    isAdminEquivalent: partial.isAdminEquivalent ?? false,
  };
}

describe('canAssignAccountRole', () => {
  const nextEmployee = { isAdminEquivalent: false };
  const nextAdmin = { isAdminEquivalent: true };

  it('allows adminEquivalent for any target role', () => {
    expect(
      canAssignAccountRole({
        actorAuthz: authz({ isAdminEquivalent: true }),
        actorUserId: 'a',
        targetUserId: 'a',
        currentTargetRole: nextAdmin,
        nextRole: nextAdmin,
      }),
    ).toBe(true);
  });

  it('denies without Assign permission', () => {
    expect(
      canAssignAccountRole({
        actorAuthz: authz({ permissions: [] }),
        actorUserId: 'a',
        targetUserId: 'b',
        currentTargetRole: null,
        nextRole: nextEmployee,
      }),
    ).toBe(false);
  });

  it('denies self-assign for delegated actor', () => {
    expect(
      canAssignAccountRole({
        actorAuthz: authz({
          permissions: [Permission.EmployeesAssignAccountRole],
        }),
        actorUserId: 'a',
        targetUserId: 'a',
        currentTargetRole: null,
        nextRole: nextEmployee,
      }),
    ).toBe(false);
  });

  it('denies mutating existing adminEquivalent target', () => {
    expect(
      canAssignAccountRole({
        actorAuthz: authz({
          permissions: [Permission.EmployeesAssignAccountRole],
        }),
        actorUserId: 'a',
        targetUserId: 'b',
        currentTargetRole: nextAdmin,
        nextRole: nextEmployee,
      }),
    ).toBe(false);
  });

  it('denies assigning adminEquivalent next role', () => {
    expect(
      canAssignAccountRole({
        actorAuthz: authz({
          permissions: [Permission.EmployeesAssignAccountRole],
        }),
        actorUserId: 'a',
        targetUserId: 'b',
        currentTargetRole: null,
        nextRole: nextAdmin,
      }),
    ).toBe(false);
  });

  it('allows non-admin assign of non-admin role to other user', () => {
    expect(
      canAssignAccountRole({
        actorAuthz: authz({
          permissions: [Permission.EmployeesAssignAccountRole],
        }),
        actorUserId: 'a',
        targetUserId: 'b',
        currentTargetRole: nextEmployee,
        nextRole: nextEmployee,
      }),
    ).toBe(true);
  });
});
