import { selectCurrentEmploymentAssignment } from '../employment-catalog/current-employment-assignment.resolver';
import { resolveEmployeeDisplayedDirection } from './resolve-employee-displayed-direction';

/**
 * Mirrors EmployeesService.batchDisplayedOrgProjection selection for unit DoD:
 * stale currentAssignmentId + valid active EA → Retail direction everywhere.
 */
function projectDisplayedDirection(input: {
  employeeId: string;
  currentAssignmentId: string | null;
  candidates: Array<{
    id: string;
    employeeId: string;
    status: string;
    startDate: string | null;
    directionId: string | null;
    directionName: string | null;
  }>;
  positionDirection?: { id: string; name: string | null } | null;
  departmentDirection?: { id: string; name: string | null } | null;
}) {
  const selected = selectCurrentEmploymentAssignment(
    input.candidates,
    input.employeeId,
    input.currentAssignmentId,
  );
  const selectedFull = selected
    ? input.candidates.find((c) => c.id === selected.id)
    : null;
  return resolveEmployeeDisplayedDirection({
    assignmentDirection: selectedFull?.directionId
      ? {
          id: selectedFull.directionId,
          name: selectedFull.directionName,
        }
      : null,
    positionDirection: input.positionDirection ?? null,
    departmentDirection: input.departmentDirection ?? null,
  });
}

describe('displayed direction after canonical current EA', () => {
  const emp = 'emp-1';
  const retail = {
    id: 'ea-retail',
    employeeId: emp,
    status: 'active',
    startDate: '2024-01-01',
    directionId: 'dir-retail',
    directionName: 'Retail',
  };
  const cancelled = {
    id: 'ea-cancelled',
    employeeId: emp,
    status: 'ended',
    startDate: '2025-01-01',
    directionId: 'dir-other',
    directionName: 'Other',
  };
  const foreign = {
    id: 'ea-foreign',
    employeeId: 'other-emp',
    status: 'active',
    startDate: '2025-06-01',
    directionId: 'dir-foreign',
    directionName: 'Foreign',
  };

  it('uses Retail when currentAssignmentId points at cancelled EA', () => {
    const d = projectDisplayedDirection({
      employeeId: emp,
      currentAssignmentId: cancelled.id,
      candidates: [cancelled, retail],
    });
    expect(d).toEqual({
      directionId: 'dir-retail',
      directionName: 'Retail',
    });
  });

  it('uses Retail when currentAssignmentId points at another employee', () => {
    const d = projectDisplayedDirection({
      employeeId: emp,
      currentAssignmentId: foreign.id,
      candidates: [foreign, retail],
    });
    expect(d).toEqual({
      directionId: 'dir-retail',
      directionName: 'Retail',
    });
  });

  it('uses Retail when currentAssignmentId is missing', () => {
    const d = projectDisplayedDirection({
      employeeId: emp,
      currentAssignmentId: 'ea-missing',
      candidates: [retail],
    });
    expect(d).toEqual({
      directionId: 'dir-retail',
      directionName: 'Retail',
    });
  });

  it('falls back position → department when EA has no direction', () => {
    const eaNoDir = {
      ...retail,
      directionId: null,
      directionName: null,
    };
    expect(
      projectDisplayedDirection({
        employeeId: emp,
        currentAssignmentId: eaNoDir.id,
        candidates: [eaNoDir],
        positionDirection: { id: 'dir-pos', name: 'FromPosition' },
      }).directionName,
    ).toBe('FromPosition');
    expect(
      projectDisplayedDirection({
        employeeId: emp,
        currentAssignmentId: eaNoDir.id,
        candidates: [eaNoDir],
        departmentDirection: { id: 'dir-dept', name: 'FromDept' },
      }).directionName,
    ).toBe('FromDept');
  });
});
