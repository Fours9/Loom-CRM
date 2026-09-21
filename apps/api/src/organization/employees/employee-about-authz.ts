import {
  hasPermission,
  hasSurface,
  type AuthorizationContext,
} from '../../platform/access-control/authorization-context';
import { Permission } from '../../platform/permissions/permission.names';

export const PEOPLE_TAB_ABOUT_SURFACE = 'people.tab.about';

/**
 * Pure About write policy.
 * Owner self-edit requires About surface; HR requires ManageProfiles + managed scope + surface.
 */
export function canEditEmployeeAbout(input: {
  authz: AuthorizationContext;
  isOwner: boolean;
  inManagedDept: boolean;
  hasAboutSurface: boolean;
}): boolean {
  if (!input.hasAboutSurface) return false;
  if (input.authz.isAdminEquivalent) return true;
  if (input.isOwner) return true;
  return (
    hasPermission(input.authz, Permission.EmployeesManageProfiles) &&
    input.inManagedDept
  );
}

export function canReadEmployeeAbout(
  authz: AuthorizationContext,
  hasAboutSurface: boolean,
): boolean {
  return hasAboutSurface || authz.isAdminEquivalent;
}

export function resolveHasAboutSurface(authz: AuthorizationContext): boolean {
  return hasSurface(authz, PEOPLE_TAB_ABOUT_SURFACE);
}
