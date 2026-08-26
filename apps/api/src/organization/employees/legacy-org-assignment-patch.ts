import type { UserRole } from '../../platform/identity/user.enums';
import { canMutateEmployeeOrgAssignment } from './can-mutate-employee-org-assignment.policy';

/**
 * Fields from UpdateEmployeeDto that may mutate denormalized org placement.
 * Empty object ⇒ strip (EmployeesService.update must not apply dept/pos).
 */
export function pickLegacyOrgAssignmentPatch(
  actor: { role: UserRole },
  dto: { departmentId?: string | null; positionId?: string | null },
): { departmentId?: string | null; positionId?: string | null } {
  if (!canMutateEmployeeOrgAssignment(actor)) {
    return {};
  }
  const out: { departmentId?: string | null; positionId?: string | null } = {};
  if (dto.departmentId !== undefined) out.departmentId = dto.departmentId;
  if (dto.positionId !== undefined) out.positionId = dto.positionId;
  return out;
}
