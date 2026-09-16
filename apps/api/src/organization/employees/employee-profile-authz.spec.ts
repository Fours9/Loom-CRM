import { Permission } from '../../platform/permissions/permission.names';
import type { AuthorizationContext } from '../../platform/access-control/authorization-context';
import {
  canCreateAccountAtEmployeeCreate,
  canEditEmergencyOnTarget,
  canManageProfilesOnTarget,
  canWritePersonalOnTarget,
} from './employee-profile-authz';

function authz(partial: {
  isAdminEquivalent?: boolean;
  permissions?: Permission[];
}): AuthorizationContext {
  return {
    userId: 'u1',
    accountRole: {
      id: 'r1',
      code: 'employee',
      name: 'E',
      permissionPreset: 'employee',
      isAdminEquivalent: partial.isAdminEquivalent ?? false,
      isSystem: true,
    },
    permissions: partial.permissions ?? [],
    surfaces: [],
    isAdminEquivalent: partial.isAdminEquivalent ?? false,
  };
}

describe('employee-profile-authz', () => {
  it('ManageProfiles alone without managed dept denies basic edit', () => {
    expect(
      canManageProfilesOnTarget(
        authz({ permissions: [Permission.EmployeesManageProfiles] }),
        false,
      ),
    ).toBe(false);
  });

  it('owner emergency edit preserved without ManageProfiles', () => {
    expect(
      canEditEmergencyOnTarget(authz({ permissions: [] }), false, true),
    ).toBe(true);
  });

  it('HR emergency requires ManageProfiles + WriteEmergency + managed', () => {
    expect(
      canEditEmergencyOnTarget(
        authz({
          permissions: [
            Permission.EmployeesManageProfiles,
            Permission.EmployeesWriteEmergency,
          ],
        }),
        true,
        false,
      ),
    ).toBe(true);
    expect(
      canEditEmergencyOnTarget(
        authz({
          permissions: [Permission.EmployeesManageProfiles],
        }),
        true,
        false,
      ),
    ).toBe(false);
  });

  it('personal write requires ManageProfiles + WritePersonal + managed', () => {
    expect(
      canWritePersonalOnTarget(
        authz({
          permissions: [
            Permission.EmployeesManageProfiles,
            Permission.EmployeesWritePersonal,
          ],
        }),
        true,
      ),
    ).toBe(true);
    expect(
      canWritePersonalOnTarget(
        authz({ permissions: [Permission.EmployeesManageProfiles] }),
        true,
      ),
    ).toBe(false);
  });

  it('adminEq bypasses create-account-at-create gate', () => {
    expect(
      canCreateAccountAtEmployeeCreate(authz({ isAdminEquivalent: true })),
    ).toBe(true);
  });

  it('create-account-at-create requires explicit permission for non-admin', () => {
    expect(canCreateAccountAtEmployeeCreate(authz({ permissions: [] }))).toBe(
      false,
    );
    expect(
      canCreateAccountAtEmployeeCreate(
        authz({ permissions: [Permission.EmployeesCreate] }),
      ),
    ).toBe(false);
    expect(
      canCreateAccountAtEmployeeCreate(
        authz({ permissions: [Permission.EmployeesCreateAccountAtCreate] }),
      ),
    ).toBe(true);
  });
});
