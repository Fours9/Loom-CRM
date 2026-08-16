import {
  compareActiveEmploymentAssignments,
  resolveEmploymentPosition,
} from './resolve-employment-position';

describe('resolveEmploymentPosition', () => {
  const emp = 'emp-1';
  const activeEa = {
    id: 'ea-active',
    employeeId: emp,
    status: 'active',
    positionId: 'pos-active',
    departmentId: 'dept-a',
    directionId: 'dir-a',
  };
  const currentEa = {
    id: 'ea-current',
    employeeId: emp,
    status: 'active',
    positionId: 'pos-current',
    departmentId: 'dept-c',
    directionId: 'dir-c',
  };

  it('prefers verified active currentAssignmentId', () => {
    expect(
      resolveEmploymentPosition({
        employeeId: emp,
        currentAssignmentId: currentEa.id,
        legacyPositionId: 'pos-legacy',
        legacyDepartmentId: 'dept-legacy',
        currentAssignment: currentEa,
        activeAssignments: [activeEa],
      }),
    ).toEqual({
      employmentAssignmentId: currentEa.id,
      positionId: 'pos-current',
      departmentId: 'dept-c',
      directionId: 'dir-c',
    });
  });

  it('falls through when currentAssignment is inactive', () => {
    expect(
      resolveEmploymentPosition({
        employeeId: emp,
        currentAssignmentId: currentEa.id,
        legacyPositionId: null,
        legacyDepartmentId: null,
        currentAssignment: { ...currentEa, status: 'ended' },
        activeAssignments: [activeEa],
      }),
    ).toEqual({
      employmentAssignmentId: activeEa.id,
      positionId: 'pos-active',
      departmentId: 'dept-a',
      directionId: 'dir-a',
    });
  });

  it('falls through when currentAssignment belongs to another employee', () => {
    expect(
      resolveEmploymentPosition({
        employeeId: emp,
        currentAssignmentId: currentEa.id,
        legacyPositionId: null,
        legacyDepartmentId: null,
        currentAssignment: { ...currentEa, employeeId: 'other' },
        activeAssignments: [activeEa],
      }),
    ).toEqual({
      employmentAssignmentId: activeEa.id,
      positionId: 'pos-active',
      departmentId: 'dept-a',
      directionId: 'dir-a',
    });
  });

  it('uses legacy positionId when no employment assignment', () => {
    expect(
      resolveEmploymentPosition({
        employeeId: emp,
        currentAssignmentId: null,
        legacyPositionId: 'pos-legacy',
        legacyDepartmentId: 'dept-legacy',
        currentAssignment: null,
        activeAssignments: [],
      }),
    ).toEqual({
      employmentAssignmentId: null,
      positionId: 'pos-legacy',
      departmentId: 'dept-legacy',
      directionId: null,
    });
  });

  it('returns nulls when nothing resolves', () => {
    expect(
      resolveEmploymentPosition({
        employeeId: emp,
        currentAssignmentId: null,
        legacyPositionId: null,
        legacyDepartmentId: null,
        currentAssignment: null,
        activeAssignments: [],
      }),
    ).toEqual({
      employmentAssignmentId: null,
      positionId: null,
      departmentId: null,
      directionId: null,
    });
  });
});

describe('compareActiveEmploymentAssignments', () => {
  it('orders by startDate DESC, then createdAt DESC, then id ASC', () => {
    const rows = [
      {
        id: 'b',
        startDate: '2024-01-01',
        createdAt: new Date('2024-06-01'),
      },
      {
        id: 'a',
        startDate: '2025-01-01',
        createdAt: new Date('2024-01-01'),
      },
      {
        id: 'c',
        startDate: null,
        createdAt: new Date('2025-01-01'),
      },
    ];
    const sorted = [...rows].sort(compareActiveEmploymentAssignments);
    expect(sorted.map((r) => r.id)).toEqual(['a', 'b', 'c']);
  });
});
