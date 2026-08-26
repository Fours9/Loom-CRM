export type DisplayedDirectionRef = {
  id: string;
  name: string | null;
};

/**
 * Deterministic Absences/list direction display (no employees.direction_id).
 * Order: current EA → position.direction → department.direction → null.
 */
export function resolveEmployeeDisplayedDirection(input: {
  assignmentDirection?: DisplayedDirectionRef | null;
  positionDirection?: DisplayedDirectionRef | null;
  departmentDirection?: DisplayedDirectionRef | null;
}): { directionId: string | null; directionName: string | null } {
  for (const ref of [
    input.assignmentDirection,
    input.positionDirection,
    input.departmentDirection,
  ]) {
    if (ref?.id) {
      return { directionId: ref.id, directionName: ref.name ?? null };
    }
  }
  return { directionId: null, directionName: null };
}
