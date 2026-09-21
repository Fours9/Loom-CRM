import {
  canEditEmployeeAbout,
  resolveHasAboutSurface,
} from './employee-about-authz';
import { Permission } from '../../platform/permissions/permission.names';
import type { AuthorizationContext } from '../../platform/access-control/authorization-context';

function authz(partial: {
  isAdminEquivalent?: boolean;
  permissions?: Permission[];
  surfaces?: string[];
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
    surfaces: partial.surfaces ?? [],
    isAdminEquivalent: partial.isAdminEquivalent ?? false,
    questionnaireTemplateCodes: [],
  };
}

describe('canEditEmployeeAbout', () => {
  it('owner + surface → true', () => {
    expect(
      canEditEmployeeAbout({
        authz: authz({ surfaces: ['people.tab.about'] }),
        isOwner: true,
        inManagedDept: false,
        hasAboutSurface: true,
      }),
    ).toBe(true);
  });

  it('owner without surface → false', () => {
    expect(
      canEditEmployeeAbout({
        authz: authz({ surfaces: [] }),
        isOwner: true,
        inManagedDept: false,
        hasAboutSurface: false,
      }),
    ).toBe(false);
  });

  it('manager + ManageProfiles + scope + surface → true', () => {
    expect(
      canEditEmployeeAbout({
        authz: authz({
          permissions: [Permission.EmployeesManageProfiles],
          surfaces: ['people.tab.about'],
        }),
        isOwner: false,
        inManagedDept: true,
        hasAboutSurface: true,
      }),
    ).toBe(true);
  });

  it('manager out of scope → false', () => {
    expect(
      canEditEmployeeAbout({
        authz: authz({
          permissions: [Permission.EmployeesManageProfiles],
          surfaces: ['people.tab.about'],
        }),
        isOwner: false,
        inManagedDept: false,
        hasAboutSurface: true,
      }),
    ).toBe(false);
  });

  it('adminEquivalent bypasses scope', () => {
    expect(
      canEditEmployeeAbout({
        authz: authz({ isAdminEquivalent: true }),
        isOwner: false,
        inManagedDept: false,
        hasAboutSurface: resolveHasAboutSurface(
          authz({ isAdminEquivalent: true }),
        ),
      }),
    ).toBe(true);
  });
});
