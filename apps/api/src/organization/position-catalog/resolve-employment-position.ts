/**
 * Pure position resolve precedence for questionnaire context snapshots (ADR 0010).
 * 1. employee.currentAssignmentId → belongs + active
 * 2. else first deterministic active employment_assignment
 * 3. else legacy employee.positionId (dept from employee; direction null)
 * 4. else all null
 */

export type EmploymentAssignmentRef = {
  id: string;
  employeeId: string;
  status: string;
  positionId: string | null;
  departmentId: string | null;
  directionId: string | null;
};

export type ResolvedEmploymentPosition = {
  employmentAssignmentId: string | null;
  positionId: string | null;
  departmentId: string | null;
  directionId: string | null;
};

export function resolveEmploymentPosition(input: {
  employeeId: string;
  currentAssignmentId: string | null;
  legacyPositionId: string | null;
  legacyDepartmentId: string | null;
  /** Row for currentAssignmentId when loaded; null if missing. */
  currentAssignment: EmploymentAssignmentRef | null;
  /** Pre-sorted deterministic active assignments for this employee. */
  activeAssignments: EmploymentAssignmentRef[];
}): ResolvedEmploymentPosition {
  const current = input.currentAssignment;
  if (
    input.currentAssignmentId &&
    current &&
    current.id === input.currentAssignmentId &&
    current.employeeId === input.employeeId &&
    current.status === 'active'
  ) {
    return {
      employmentAssignmentId: current.id,
      positionId: current.positionId,
      departmentId: current.departmentId,
      directionId: current.directionId,
    };
  }

  const active = input.activeAssignments[0];
  if (active) {
    return {
      employmentAssignmentId: active.id,
      positionId: active.positionId,
      departmentId: active.departmentId,
      directionId: active.directionId,
    };
  }

  if (input.legacyPositionId) {
    return {
      employmentAssignmentId: null,
      positionId: input.legacyPositionId,
      departmentId: input.legacyDepartmentId,
      directionId: null,
    };
  }

  return {
    employmentAssignmentId: null,
    positionId: null,
    departmentId: null,
    directionId: null,
  };
}

/** Deterministic order: startDate DESC nulls last, createdAt DESC, id ASC. */
export function compareActiveEmploymentAssignments(
  a: { startDate: string | null; createdAt: Date; id: string },
  b: { startDate: string | null; createdAt: Date; id: string },
): number {
  const aStart = a.startDate ?? '';
  const bStart = b.startDate ?? '';
  if (aStart !== bStart) {
    if (!aStart) return 1;
    if (!bStart) return -1;
    return bStart.localeCompare(aStart);
  }
  const byCreated = b.createdAt.getTime() - a.createdAt.getTime();
  if (byCreated !== 0) return byCreated;
  return a.id.localeCompare(b.id);
}
