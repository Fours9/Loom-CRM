import type { AuthorizationContext } from '../../platform/access-control/authorization-context';

/**
 * Legacy PATCH org placement (department/position on EmployeesService.update).
 * Writer is already adminEquivalent-only — keep this predicate aligned (do not widen).
 *
 * People canonical capability: {@link canChangeAssignmentOnTarget}.
 *
 * @deprecated Prefer canChangeAssignmentOnTarget for serializers / People UI.
 */
export function canMutateEmployeeOrgAssignment(authz: {
  isAdminEquivalent: boolean;
}): boolean {
  return authz.isAdminEquivalent;
}

/** @deprecated Use AuthorizationContext overload. */
export function canMutateEmployeeOrgAssignmentFromAuthz(
  authz: AuthorizationContext,
): boolean {
  return authz.isAdminEquivalent;
}
