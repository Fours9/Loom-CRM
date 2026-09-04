import { Permission } from '../permissions/permission.names';
import {
  hasPermission,
  type AuthorizationContext,
} from './authorization-context';

/**
 * Classification predicates for confidential resources.
 * One permission (`confidential.view`), two predicates: canView ≠ canMark (owner read-exception).
 */
export class ConfidentialAccessPolicy {
  static canView(
    ctx: AuthorizationContext,
    { isOwner }: { isOwner: boolean },
  ): boolean {
    return (
      ctx.isAdminEquivalent ||
      isOwner ||
      hasPermission(ctx, Permission.ConfidentialView)
    );
  }

  static canMark(ctx: AuthorizationContext): boolean {
    return (
      ctx.isAdminEquivalent || hasPermission(ctx, Permission.ConfidentialView)
    );
  }
}
