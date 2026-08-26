/**
 * Absences admin live-preview for Напрямок after dept/pos change.
 * Prefer position.directionName / directionId catalog; else department.directionName.
 */
export function resolveAbsencesOrgDirectionLabel(input: {
  departmentId: string | null | undefined;
  positionId: string | null | undefined;
  departments: Array<{
    id: string;
    directionId?: string | null;
    directionName?: string | null;
  }>;
  positions: Array<{
    id: string;
    directionId?: string | null;
    directionName?: string | null;
  }>;
}): string | null {
  const position = input.positionId
    ? input.positions.find((p) => p.id === input.positionId)
    : undefined;
  if (position?.directionName) {
    return position.directionName;
  }
  if (position?.directionId) {
    const deptWithDir = input.departments.find(
      (d) => d.directionId === position.directionId && d.directionName,
    );
    if (deptWithDir?.directionName) return deptWithDir.directionName;
  }

  const department = input.departmentId
    ? input.departments.find((d) => d.id === input.departmentId)
    : undefined;
  return department?.directionName ?? null;
}
