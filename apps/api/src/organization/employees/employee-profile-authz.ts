import {
  hasPermission,
  type AuthorizationContext,
} from '../../platform/access-control/authorization-context';
import { Permission } from '../../platform/permissions/permission.names';

/** Pure projections — managedDept already resolved (includes owner when own dept managed). */

export function canManageProfilesOnTarget(
  authz: AuthorizationContext,
  inManagedDept: boolean,
): boolean {
  if (authz.isAdminEquivalent) return true;
  return (
    hasPermission(authz, Permission.EmployeesManageProfiles) && inManagedDept
  );
}

export function canEditEmergencyOnTarget(
  authz: AuthorizationContext,
  inManagedDept: boolean,
  isOwner: boolean,
): boolean {
  if (authz.isAdminEquivalent) return true;
  if (isOwner) return true;
  return (
    hasPermission(authz, Permission.EmployeesManageProfiles) &&
    hasPermission(authz, Permission.EmployeesWriteEmergency) &&
    inManagedDept
  );
}

export function canWritePersonalOnTarget(
  authz: AuthorizationContext,
  inManagedDept: boolean,
): boolean {
  if (authz.isAdminEquivalent) return true;
  return (
    hasPermission(authz, Permission.EmployeesManageProfiles) &&
    hasPermission(authz, Permission.EmployeesWritePersonal) &&
    inManagedDept
  );
}

export function canChangeAssignmentOnTarget(
  authz: AuthorizationContext,
  inManagedDept: boolean,
): boolean {
  if (authz.isAdminEquivalent) return true;
  return (
    hasPermission(authz, Permission.EmployeesManageProfiles) &&
    hasPermission(authz, Permission.EmployeesChangeAssignment) &&
    inManagedDept
  );
}

export function canChangeStatusOnTarget(
  authz: AuthorizationContext,
  inManagedDept: boolean,
): boolean {
  if (authz.isAdminEquivalent) return true;
  return (
    hasPermission(authz, Permission.EmployeesManageProfiles) &&
    hasPermission(authz, Permission.EmployeesChangeStatus) &&
    inManagedDept
  );
}

/** Workflow-gate for createAccount=true on POST /employees — ≠ attach. */
export function canCreateAccountAtEmployeeCreate(
  authz: AuthorizationContext,
): boolean {
  if (authz.isAdminEquivalent) return true;
  return hasPermission(authz, Permission.EmployeesCreateAccountAtCreate);
}
