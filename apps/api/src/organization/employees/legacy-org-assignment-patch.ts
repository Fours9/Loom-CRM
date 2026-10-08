/**
 * Fields from UpdateEmployeeDto that may mutate denormalized org placement.
 * Empty object ⇒ strip (EmployeesService.update must not apply dept/pos).
 *
 * Legacy writer requires adminEquivalent (see EmployeesService.update).
 */
export function pickLegacyOrgAssignmentPatch(
  authz: { isAdminEquivalent: boolean },
  dto: { departmentId?: string | null; positionId?: string | null },
): { departmentId?: string | null; positionId?: string | null } {
  if (!authz.isAdminEquivalent) {
    return {};
  }
  const out: { departmentId?: string | null; positionId?: string | null } = {};
  if (dto.departmentId !== undefined) out.departmentId = dto.departmentId;
  if (dto.positionId !== undefined) out.positionId = dto.positionId;
  return out;
}
