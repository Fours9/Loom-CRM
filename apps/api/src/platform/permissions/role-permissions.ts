import { Permission } from './permission.names';
import { UserRole } from '../identity/user.enums';

const EMPLOYEE: Permission[] = [
  Permission.EmployeesView,
  Permission.AbsencesCreate,
  Permission.AbsencesCancel,
  Permission.AbsencesCalendarView,
];

const DEPARTMENT_MANAGER: Permission[] = [
  ...EMPLOYEE,
  Permission.EmployeesEdit,
  Permission.AbsencesApprove,
];

const ADMIN: Permission[] = [
  ...DEPARTMENT_MANAGER,
  Permission.EmployeesCreate,
  Permission.DepartmentsManage,
  Permission.PositionsManage,
  Permission.SettingsManage,
  Permission.AuditView,
];

const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  [UserRole.Employee]: EMPLOYEE,
  [UserRole.DepartmentManager]: DEPARTMENT_MANAGER,
  [UserRole.Admin]: ADMIN,
};

export function permissionsForRole(role: UserRole): Permission[] {
  return [...ROLE_PERMISSIONS[role]];
}
