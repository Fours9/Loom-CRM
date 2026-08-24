/**
 * Compares locked org rows to the discovery snapshot for rows that were resolved.
 * Absent optional parents are not treated as drift (all-null / direction-only writes).
 */
export function didAssignmentHierarchyDrift(input: {
  candidateCompanyId: string | null;
  candidateDirectionId: string | null;
  candidateDepartmentId: string | null;
  candidatePositionId: string | null;
  lockedDirectionCompanyId: string | null | undefined;
  lockedDepartmentDirectionId: string | null | undefined;
  lockedPositionDepartmentId: string | null | undefined;
  discoveryPositionDepartmentId: string | null | undefined;
  lockedPositionDirectionId: string | null | undefined;
  discoveryPositionDirectionId: string | null | undefined;
}): boolean {
  if (input.candidateDirectionId != null) {
    if ((input.lockedDirectionCompanyId ?? null) !== input.candidateCompanyId) {
      return true;
    }
  }
  if (input.candidateDepartmentId != null) {
    if (
      (input.lockedDepartmentDirectionId ?? null) !== input.candidateDirectionId
    ) {
      return true;
    }
  }
  if (input.candidatePositionId != null) {
    if (
      (input.lockedPositionDepartmentId ?? null) !==
        (input.discoveryPositionDepartmentId ?? null) ||
      (input.lockedPositionDirectionId ?? null) !==
        (input.discoveryPositionDirectionId ?? null)
    ) {
      return true;
    }
  }
  return false;
}
