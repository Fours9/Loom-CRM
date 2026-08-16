/**
 * Pure Position.directionId inheritance (ADR 0010 Decision #10).
 * - department set → inherit department.directionId (ignore explicit unless it matches)
 * - department null → optional explicit direction
 *
 * Callers must pass only *explicit* direction from the request body — never the
 * old persisted position.directionId when resolving after a department change.
 */
export function resolvePositionDirectionId(input: {
  departmentDirectionId: string | null | undefined;
  hasDepartment: boolean;
  explicitDirectionId?: string | null;
}): { ok: true; directionId: string | null } | { ok: false; error: string } {
  if (input.hasDepartment) {
    const inherited = input.departmentDirectionId ?? null;
    if (
      input.explicitDirectionId != null &&
      input.explicitDirectionId !== inherited
    ) {
      return {
        ok: false,
        error:
          'When a department is set, position directionId must match department.directionId',
      };
    }
    return { ok: true, directionId: inherited };
  }
  return {
    ok: true,
    directionId:
      input.explicitDirectionId === undefined
        ? null
        : input.explicitDirectionId,
  };
}
