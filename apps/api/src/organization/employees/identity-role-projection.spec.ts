import { Injectable } from '@nestjs/common';
import { IdentityRoleProjection } from './identity-role-projection';
import { UserRole } from '../../platform/identity/user.enums';
import { ManagementKind } from '../employment-catalog/management-kind';
import { SystemAccountRoleCode } from '../../platform/access-control/system-account-role-codes';
import { AccountRole } from '../../platform/access-control/account-role.entity';
import { EmploymentAssignment } from './employment-assignment.entity';

describe('IdentityRoleProjection bridge helpers', () => {
  const projection = new IdentityRoleProjection(
    null as unknown as ConstructorParameters<typeof IdentityRoleProjection>[0],
  );

  it('bridgeable only for system employee/DM', () => {
    expect(projection.isBridgeableAccountRole(null)).toBe(true);
    expect(
      projection.isBridgeableAccountRole({
        code: 'employee',
        isSystem: true,
        isAdminEquivalent: false,
      } as AccountRole),
    ).toBe(true);
    expect(
      projection.isBridgeableAccountRole({
        code: 'director',
        isSystem: true,
        isAdminEquivalent: false,
      } as AccountRole),
    ).toBe(false);
    expect(
      projection.isBridgeableAccountRole({
        code: 'admin',
        isSystem: true,
        isAdminEquivalent: true,
      } as AccountRole),
    ).toBe(false);
    expect(
      projection.isBridgeableAccountRole({
        code: null,
        isSystem: false,
        isAdminEquivalent: false,
      } as AccountRole),
    ).toBe(false);
  });

  it('desiredBridgeCode uses managementKind', () => {
    expect(projection.desiredBridgeCode(null)).toBe(
      SystemAccountRoleCode.Employee,
    );
    expect(
      projection.desiredBridgeCode({
        managementKind: ManagementKind.Direction,
        isDepartmentManager: true,
      } as EmploymentAssignment),
    ).toBe(SystemAccountRoleCode.DepartmentManager);
    expect(
      projection.desiredBridgeCode({
        managementKind: ManagementKind.None,
        isDepartmentManager: false,
      } as EmploymentAssignment),
    ).toBe(SystemAccountRoleCode.Employee);
  });

  it('mirrorRoleForSystemCode', () => {
    expect(
      projection.mirrorRoleForSystemCode(SystemAccountRoleCode.Employee),
    ).toBe(UserRole.Employee);
    expect(
      projection.mirrorRoleForSystemCode(
        SystemAccountRoleCode.DepartmentManager,
      ),
    ).toBe(UserRole.DepartmentManager);
  });
});
