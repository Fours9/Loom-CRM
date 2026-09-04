import { Permission } from '../permissions/permission.names';
import type { AccountRolePermissionPreset } from './account-role.entity';

export type AuthorizationAccountRole = {
  id: string;
  code: string | null;
  name: string;
  permissionPreset: AccountRolePermissionPreset;
  isAdminEquivalent: boolean;
  isSystem: boolean;
};

/**
 * Single authZ snapshot for a User: what they may do (permissions),
 * what UI they may see (surfaces) and whether they bypass both.
 */
export type AuthorizationContext = {
  userId: string;
  accountRole: AuthorizationAccountRole;
  permissions: Permission[];
  surfaces: string[];
  isAdminEquivalent: boolean;
};

export function hasPermission(
  context: AuthorizationContext,
  permission: Permission,
): boolean {
  return context.isAdminEquivalent || context.permissions.includes(permission);
}

export function hasSurface(
  context: AuthorizationContext,
  surfaceId: string,
): boolean {
  return context.isAdminEquivalent || context.surfaces.includes(surfaceId);
}
