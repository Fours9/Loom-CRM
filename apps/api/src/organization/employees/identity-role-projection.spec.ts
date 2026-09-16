import { compatibilityUserRoleFromAccountRole } from './identity-role-projection';
import { UserRole } from '../../platform/identity/user.enums';
import { AccountRole } from '../../platform/access-control/account-role.entity';

describe('compatibilityUserRoleFromAccountRole', () => {
  it('maps presets and adminEquivalent', () => {
    expect(
      compatibilityUserRoleFromAccountRole({
        permissionPreset: 'admin',
        isAdminEquivalent: false,
      } as AccountRole),
    ).toBe(UserRole.Admin);
    expect(
      compatibilityUserRoleFromAccountRole({
        permissionPreset: 'employee',
        isAdminEquivalent: true,
      } as AccountRole),
    ).toBe(UserRole.Admin);
    expect(
      compatibilityUserRoleFromAccountRole({
        permissionPreset: 'department_manager',
        isAdminEquivalent: false,
      } as AccountRole),
    ).toBe(UserRole.DepartmentManager);
    expect(
      compatibilityUserRoleFromAccountRole({
        permissionPreset: 'employee',
        isAdminEquivalent: false,
      } as AccountRole),
    ).toBe(UserRole.Employee);
  });
});
