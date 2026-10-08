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

/** Class C — team comment view; no target-scope (legacy preserve). */
export function canViewTeamComment(authz: AuthorizationContext): boolean {
  if (authz.isAdminEquivalent) return true;
  return hasPermission(authz, Permission.EmployeesReadTeamComment);
}

/** Class C — PDF export; still requires canViewEmployeeProfile. */
export function canExportProfile(
  authz: AuthorizationContext,
  canViewTarget: boolean,
): boolean {
  if (!canViewTarget) return false;
  if (authz.isAdminEquivalent) return true;
  return hasPermission(authz, Permission.EmployeesExportProfile);
}

export function canViewAccountDetails(
  authz: AuthorizationContext,
  isOwner: boolean,
): boolean {
  return authz.isAdminEquivalent || isOwner;
}

export function canEditAccountEmail(
  authz: AuthorizationContext,
  facts: { hasOtherUser: boolean; isSelf: boolean },
): boolean {
  return (
    authz.isAdminEquivalent && facts.hasOtherUser && !facts.isSelf
  );
}

export function canViewWorkContacts(
  authz: AuthorizationContext,
  isOwner: boolean,
  canViewProfile: boolean,
): boolean {
  return authz.isAdminEquivalent || isOwner || canViewProfile;
}

export function canViewAdminComment(authz: AuthorizationContext): boolean {
  return authz.isAdminEquivalent;
}

export function canEditAdminComment(authz: AuthorizationContext): boolean {
  return authz.isAdminEquivalent;
}

export function canResetPassword(
  authz: AuthorizationContext,
  hasAccount: boolean,
): boolean {
  return authz.isAdminEquivalent && hasAccount;
}

export function canDestructivelyManageAccount(
  authz: AuthorizationContext,
  hasAccount: boolean,
  isSelf: boolean,
): boolean {
  return authz.isAdminEquivalent && hasAccount && !isSelf;
}

export function canDeleteEmployee(
  authz: AuthorizationContext,
  isSelf: boolean,
): boolean {
  return authz.isAdminEquivalent && !isSelf;
}

export function canViewPersonalContacts(
  authz: AuthorizationContext,
  isOwner: boolean,
): boolean {
  if (authz.isAdminEquivalent || isOwner) return true;
  return hasPermission(authz, Permission.EmployeesReadPersonal);
}

export function canViewEmergencyContact(
  authz: AuthorizationContext,
  isOwner: boolean,
): boolean {
  if (authz.isAdminEquivalent || isOwner) return true;
  return hasPermission(authz, Permission.EmployeesReadEmergency);
}

/**
 * History OR-branch (preserve):
 * adminEq ∨ ViewHistory ∨ (canView ∧ ManageProfiles).
 */
export function canViewHistory(
  authz: AuthorizationContext,
  canView: boolean,
): boolean {
  if (authz.isAdminEquivalent) return true;
  if (hasPermission(authz, Permission.EmployeesViewHistory)) return true;
  return (
    canView && hasPermission(authz, Permission.EmployeesManageProfiles)
  );
}

export function canViewVisibilityOverrides(
  authz: AuthorizationContext,
): boolean {
  return authz.isAdminEquivalent;
}

export function canEditVisibilityOverrides(
  authz: AuthorizationContext,
): boolean {
  return authz.isAdminEquivalent;
}
