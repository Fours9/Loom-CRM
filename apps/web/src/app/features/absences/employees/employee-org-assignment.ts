/**
 * Single FE entry for optional employee org assignment (department / position).
 * Empty or whitespace form values become null for write APIs (UUID validators reject "").
 */

export type EmployeeOrgAssignmentIds = {
  departmentId: string | null;
  positionId: string | null;
};

export function optionalOrgAssignmentIds(input: {
  departmentId?: string | null;
  positionId?: string | null;
}): EmployeeOrgAssignmentIds {
  return {
    departmentId: emptyToNull(input.departmentId),
    positionId: emptyToNull(input.positionId),
  };
}

function emptyToNull(value?: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
