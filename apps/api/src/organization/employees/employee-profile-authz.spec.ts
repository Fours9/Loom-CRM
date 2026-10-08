import { Permission } from '../../platform/permissions/permission.names';
import type { AuthorizationContext } from '../../platform/access-control/authorization-context';
import {
  canCreateAccountAtEmployeeCreate,
  canEditEmergencyOnTarget,
  canExportProfile,
  canManageProfilesOnTarget,
  canViewHistory,
  canViewTeamComment,
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
    questionnaireTemplateCodes: [],
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

  it('Class C comment: permission without scope; ManageProfiles alone denies', () => {
    expect(
      canViewTeamComment(
        authz({ permissions: [Permission.EmployeesReadTeamComment] }),
      ),
    ).toBe(true);
    expect(
      canViewTeamComment(
        authz({ permissions: [Permission.EmployeesManageProfiles] }),
      ),
    ).toBe(false);
    expect(canViewTeamComment(authz({ isAdminEquivalent: true }))).toBe(true);
  });

  it('Class C export requires permission AND canView', () => {
    expect(
      canExportProfile(
        authz({ permissions: [Permission.EmployeesExportProfile] }),
        true,
      ),
    ).toBe(true);
    expect(
      canExportProfile(
        authz({ permissions: [Permission.EmployeesExportProfile] }),
        false,
      ),
    ).toBe(false);
    expect(
      canExportProfile(
        authz({ permissions: [Permission.EmployeesManageProfiles] }),
        true,
      ),
    ).toBe(false);
    expect(canExportProfile(authz({ isAdminEquivalent: true }), true)).toBe(
      true,
    );
  });

  it('history OR-branch: ViewHistory or ManageProfiles∧canView', () => {
    expect(
      canViewHistory(
        authz({ permissions: [Permission.EmployeesViewHistory] }),
        false,
      ),
    ).toBe(true);
    expect(
      canViewHistory(
        authz({ permissions: [Permission.EmployeesManageProfiles] }),
        true,
      ),
    ).toBe(true);
    expect(
      canViewHistory(
        authz({ permissions: [Permission.EmployeesManageProfiles] }),
        false,
      ),
    ).toBe(false);
  });
});
