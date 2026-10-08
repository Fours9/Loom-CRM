import { ForbiddenException } from '@nestjs/common';
import {
  hasPermission,
  type AuthorizationContext,
} from '../../../platform/access-control/authorization-context';
import { Permission } from '../../../platform/permissions/permission.names';

/**
 * Workflow concerns that must NOT live in TypeCatalog:
 * create-for-other, backdating, approval, adjust-after-approve.
 *
 * AuthZ SoT = AuthorizationContext (+ managed-scope fact from Organization).
 * Never users.role.
 *
 * @see docs/adr/0008-work-calendar-via-absences.md
 */
export type TimeEventWorkflowContext = {
  authz: AuthorizationContext;
  targetEmployeeUserId: string | null;
  /** Actor may create for this target via managed leadership scope (or adminEq). */
  canCreateForTarget: boolean;
};

export const TimeEventWorkflowPolicy = {
  /**
   * Create-for-other: adminEq OR (AbsencesCreate ∧ managed scope on target).
   * Self-create always allowed when AbsencesCreate holds (HTTP guard).
   */
  assertCanCreateFor(ctx: TimeEventWorkflowContext): void {
    const isSelf =
      ctx.targetEmployeeUserId != null &&
      ctx.targetEmployeeUserId === ctx.authz.userId;
    if (isSelf) return;

    if (ctx.authz.isAdminEquivalent) return;

    if (
      hasPermission(ctx.authz, Permission.AbsencesCreate) &&
      ctx.canCreateForTarget
    ) {
      return;
    }

    throw new ForbiddenException(
      'Cannot create time event for another employee',
    );
  },

  /** MVP: no type-specific backdating rules beyond future Organization TZ settings. */
  assertBackdatingAllowed(
    _ctx: TimeEventWorkflowContext,
    _startDate: string,
  ): void {
    // Intentionally open in MVP — catalog must not own this.
  },

  canCreateForOther(input: {
    authz: AuthorizationContext;
    hasManagedScope: boolean;
  }): boolean {
    if (input.authz.isAdminEquivalent) return true;
    return (
      hasPermission(input.authz, Permission.AbsencesCreate) &&
      input.hasManagedScope
    );
  },
};
