import {
  hasPermission,
  type AuthorizationContext,
} from '../../platform/access-control/authorization-context';
import { Permission } from '../../platform/permissions/permission.names';

export type AccountRoleCeilingFacts = {
  isAdminEquivalent: boolean;
};

/**
 * Admin-equivalent ceiling for AccountRole assignment (not full permission-subset).
 * Single entry for create / access-settings / attach(explicit role).
 */
export function canAssignAccountRole(input: {
  actorAuthz: AuthorizationContext;
  actorUserId: string;
  targetUserId: string | null;
  currentTargetRole: AccountRoleCeilingFacts | null;
  nextRole: AccountRoleCeilingFacts;
}): boolean {
  if (input.actorAuthz.isAdminEquivalent) return true;
  if (
    !hasPermission(
      input.actorAuthz,
      Permission.EmployeesAssignAccountRole,
    )
  ) {
    return false;
  }
  if (
    input.targetUserId != null &&
    input.targetUserId === input.actorUserId
  ) {
    return false;
  }
  if (input.currentTargetRole?.isAdminEquivalent) return false;
  if (input.nextRole.isAdminEquivalent) return false;
  return true;
}
