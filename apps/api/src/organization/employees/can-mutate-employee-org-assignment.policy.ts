import { Permission } from '../../platform/permissions/permission.names';
import { permissionsForRole } from '../../platform/permissions/role-permissions';
import { UserRole } from '../../platform/identity/user.enums';

/**
 * Single predicate for mutating employee org placement (department / position)
 * on legacy PATCH and for People `canEditEmployment` / Absences `canEditOrgAssignment`.
 * Matches role matrix: `employees.change_assignment` (Admin today).
 */
export function canMutateEmployeeOrgAssignment(actor: {
  role: UserRole;
}): boolean {
  return permissionsForRole(actor.role).includes(
    Permission.EmployeesChangeAssignment,
  );
}
