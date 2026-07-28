import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '../../../platform/identity/user.enums';
import type { User } from '../../../platform/identity/user.entity';

/**
 * Workflow concerns that must NOT live in TypeCatalog:
 * roles, create-for-other, backdating, approval, adjust-after-approve.
 *
 * MVP: thin boundary object wrapping existing role checks.
 * Broader policy (attachment/comment requirements by role) can grow here later.
 *
 * @see docs/adr/0008-work-calendar-via-absences.md
 */
export type TimeEventWorkflowContext = {
  actor: User;
  targetEmployeeUserId: string | null;
};

export const TimeEventWorkflowPolicy = {
  assertCanCreateFor(ctx: TimeEventWorkflowContext): void {
    if (ctx.actor.role === UserRole.Employee) {
      if (
        ctx.targetEmployeeUserId &&
        ctx.targetEmployeeUserId !== ctx.actor.id
      ) {
        throw new ForbiddenException(
          'Cannot create time event for another employee',
        );
      }
    }
  },

  /** MVP: no type-specific backdating rules beyond future Organization TZ settings. */
  assertBackdatingAllowed(_ctx: TimeEventWorkflowContext, _startDate: string): void {
    // Intentionally open in MVP — catalog must not own this.
  },
};
