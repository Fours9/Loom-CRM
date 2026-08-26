import {
  compareCurrentEmploymentAssignments,
  selectCurrentEmploymentAssignment,
} from './current-employment-assignment.resolver';

describe('selectCurrentEmploymentAssignment', () => {
  const emp = 'emp-1';
  const older = {
    id: 'ea-older',
    employeeId: emp,
    status: 'active',
    startDate: '2024-01-01',
  };
  const newer = {
    id: 'ea-newer',
    employeeId: emp,
    status: 'active',
    startDate: '2025-06-01',
  };
  const current = {
    id: 'ea-current',
    employeeId: emp,
    status: 'active',
    startDate: '2023-01-01',
  };

  it('prefers verified active currentAssignmentId', () => {
    expect(
      selectCurrentEmploymentAssignment(
        [newer, older, current],
        emp,
        current.id,
      ),
    ).toEqual(current);
  });

  it('falls through when currentAssignment is inactive', () => {
    expect(
      selectCurrentEmploymentAssignment(
        [{ ...current, status: 'ended' }, newer, older],
        emp,
        current.id,
      ),
    ).toEqual(newer);
  });

  it('falls through when currentAssignment belongs to another employee', () => {
    expect(
      selectCurrentEmploymentAssignment(
        [{ ...current, employeeId: 'other' }, newer, older],
        emp,
        current.id,
      ),
    ).toEqual(newer);
  });

  it('falls through when currentAssignmentId is missing from candidates', () => {
    expect(
      selectCurrentEmploymentAssignment([newer, older], emp, 'ea-missing'),
    ).toEqual(newer);
  });

  it('returns null when no active assignment', () => {
    expect(
      selectCurrentEmploymentAssignment(
        [{ ...newer, status: 'ended' }],
        emp,
        null,
      ),
    ).toBeNull();
  });

  it('orders by startDate DESC NULLS LAST, then id DESC', () => {
    const nullStart = {
      id: 'ea-null',
      employeeId: emp,
      status: 'active',
      startDate: null,
    };
    const sameDateA = {
      id: 'ea-a',
      employeeId: emp,
      status: 'active',
      startDate: '2025-01-01',
    };
    const sameDateZ = {
      id: 'ea-z',
      employeeId: emp,
      status: 'active',
      startDate: '2025-01-01',
    };

    expect(
      selectCurrentEmploymentAssignment(
        [nullStart, sameDateA, sameDateZ, older],
        emp,
        null,
      ),
    ).toEqual(sameDateZ);
  });
});

describe('compareCurrentEmploymentAssignments', () => {
  it('puts null startDate last', () => {
    const sorted = [
      { startDate: null, id: 'n' },
      { startDate: '2024-01-01', id: 'a' },
      { startDate: '2025-01-01', id: 'b' },
    ].sort(compareCurrentEmploymentAssignments);

    expect(sorted.map((r) => r.id)).toEqual(['b', 'a', 'n']);
  });
});
