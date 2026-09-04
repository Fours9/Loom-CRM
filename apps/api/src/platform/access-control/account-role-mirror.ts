import { UserRole } from '../identity/user.enums';
import type { AccountRole } from './account-role.entity';

/**
 * `users.role` / `employees.role` are compatibility mirrors of the account role
 * (ADR 0011 §3). The UserRole enum stays employee | department_manager | admin,
 * so `director` mirrors to its preset (department_manager).
 */
export function userRoleMirrorFor(
  role: Pick<AccountRole, 'isAdminEquivalent' | 'permissionPreset'>,
): UserRole {
  if (role.isAdminEquivalent) {
    return UserRole.Admin;
  }
  return role.permissionPreset === 'department_manager'
    ? UserRole.DepartmentManager
    : UserRole.Employee;
}
