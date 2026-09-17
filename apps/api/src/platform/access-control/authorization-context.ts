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
  /**
   * Sorted opaque questionnaire template codes granted to the account role.
   * Empty means none (fail-closed) unless isAdminEquivalent.
   */
  questionnaireTemplateCodes: string[];
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

/** AdminEq bypasses template grants; otherwise code must be in the grant list. */
export function hasQuestionnaireTemplate(
  context: AuthorizationContext,
  templateCode: string,
): boolean {
  if (context.isAdminEquivalent) return true;
  return context.questionnaireTemplateCodes.includes(templateCode);
}
