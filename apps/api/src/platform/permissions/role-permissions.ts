import { Permission } from './permission.names';
import { UserRole } from '../identity/user.enums';

const EMPLOYEE: Permission[] = [
  Permission.EmployeesView,
  Permission.AbsencesCreate,
  Permission.AbsencesCancel,
  Permission.AbsencesCalendarView,
  Permission.DocumentsView,
  Permission.QuestionnairesView,
  Permission.QuestionnairesCompleteSelf,
];

/**
 * Variant A: ManageProfiles and QuestionnairesAssign are extra-controlled,
 * not in the DM base preset (seeded as extras for DM-preset roles on migrate).
 */
const DEPARTMENT_MANAGER: Permission[] = [
  ...EMPLOYEE,
  Permission.AbsencesApprove,
];

const ADMIN: Permission[] = [
  ...DEPARTMENT_MANAGER,
  Permission.QuestionnairesAssign,
  Permission.EmployeesCreate,
  Permission.EmployeesCreateAccountAtCreate,
  Permission.EmployeesManageProfiles,
  Permission.EmployeesAssignAccountRole,
  Permission.EmployeesReadPersonal,
  Permission.EmployeesWritePersonal,
  Permission.EmployeesReadEmergency,
  Permission.EmployeesWriteEmergency,
  Permission.EmployeesChangeAssignment,
  Permission.EmployeesChangeStatus,
  Permission.EmployeesViewHistory,
  Permission.EmployeesReadTeamComment,
  Permission.EmployeesExportProfile,
  Permission.DocumentsManage,
  Permission.ConfidentialView,
  Permission.QuestionnairesManageLifecycle,
  Permission.QuestionnairesDelete,
  Permission.QuestionnairesCompleteAny,
  Permission.QuestionnairesReview,
  Permission.QuestionnairesApplyProfileChanges,
  Permission.QuestionnairesReadAssignmentComment,
  Permission.DepartmentsManage,
  Permission.PositionsManage,
  Permission.DirectionsManage,
  Permission.AbsencesAdmin,
  Permission.SettingsManage,
  Permission.AuditView,
];

const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  [UserRole.Employee]: EMPLOYEE,
  [UserRole.DepartmentManager]: DEPARTMENT_MANAGER,
  [UserRole.Admin]: ADMIN,
};

const PRESET_PERMISSIONS: Record<string, readonly Permission[]> = {
  employee: EMPLOYEE,
  department_manager: DEPARTMENT_MANAGER,
  admin: ADMIN,
};

/** @deprecated Account role presets are the authZ source of truth (ADR 0011). */
export function permissionsForRole(role: UserRole): Permission[] {
  return [...ROLE_PERMISSIONS[role]];
}

/** Base permissions of an account-role preset. Unknown preset → throw (fail closed). */
export function permissionsForPreset(preset: string): Permission[] {
  const permissions = PRESET_PERMISSIONS[preset];
  if (!permissions) {
    throw new Error(`Unknown account role permission preset: ${preset}`);
  }
  return [...permissions];
}

/** Full admin-equivalent permission set. */
export function allAdminPermissions(): Permission[] {
  return [...ADMIN];
}

export function isPermission(value: unknown): value is Permission {
  return (
    typeof value === 'string' &&
    (Object.values(Permission) as string[]).includes(value)
  );
}
