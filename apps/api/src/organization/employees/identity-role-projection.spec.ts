import { UserRole } from '../../platform/identity/user.enums';
import { IdentityRoleProjection } from './identity-role-projection';
import type { EmploymentAssignment } from './employment-assignment.entity';

describe('IdentityRoleProjection.deriveRole', () => {
  const projection = Object.create(
    IdentityRoleProjection.prototype,
  ) as IdentityRoleProjection;

  const ea = (manager: boolean): EmploymentAssignment =>
    ({ isDepartmentManager: manager } as EmploymentAssignment);

  it('adminAccess true → admin', () => {
    expect(
      projection.deriveRole({
        adminAccess: true,
        currentRole: UserRole.Employee,
        activeEa: ea(true),
      }),
    ).toBe(UserRole.Admin);
  });

  it('preserve + current admin → admin', () => {
    expect(
      projection.deriveRole({
        adminAccess: 'preserve',
        currentRole: UserRole.Admin,
        activeEa: ea(false),
      }),
    ).toBe(UserRole.Admin);
  });

  it('adminAccess false + EA manager → department_manager', () => {
    expect(
      projection.deriveRole({
        adminAccess: false,
        currentRole: UserRole.Admin,
        activeEa: ea(true),
      }),
    ).toBe(UserRole.DepartmentManager);
  });

  it('preserve non-admin + EA manager → department_manager', () => {
    expect(
      projection.deriveRole({
        adminAccess: 'preserve',
        currentRole: UserRole.Employee,
        activeEa: ea(true),
      }),
    ).toBe(UserRole.DepartmentManager);
  });

  it('no EA manager → employee', () => {
    expect(
      projection.deriveRole({
        adminAccess: 'preserve',
        currentRole: UserRole.DepartmentManager,
        activeEa: ea(false),
      }),
    ).toBe(UserRole.Employee);
  });

  it('null EA → employee', () => {
    expect(
      projection.deriveRole({
        adminAccess: false,
        currentRole: UserRole.DepartmentManager,
        activeEa: null,
      }),
    ).toBe(UserRole.Employee);
  });
});
