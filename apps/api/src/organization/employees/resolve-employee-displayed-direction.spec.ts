import { resolveEmployeeDisplayedDirection } from './resolve-employee-displayed-direction';

describe('resolveEmployeeDisplayedDirection', () => {
  it('prefers current assignment direction', () => {
    expect(
      resolveEmployeeDisplayedDirection({
        assignmentDirection: { id: 'ea-dir', name: 'EA' },
        positionDirection: { id: 'pos-dir', name: 'Pos' },
        departmentDirection: { id: 'dept-dir', name: 'Dept' },
      }),
    ).toEqual({ directionId: 'ea-dir', directionName: 'EA' });
  });

  it('falls back to position then department', () => {
    expect(
      resolveEmployeeDisplayedDirection({
        assignmentDirection: null,
        positionDirection: { id: 'pos-dir', name: 'Pos' },
        departmentDirection: { id: 'dept-dir', name: 'Dept' },
      }),
    ).toEqual({ directionId: 'pos-dir', directionName: 'Pos' });

    expect(
      resolveEmployeeDisplayedDirection({
        assignmentDirection: null,
        positionDirection: null,
        departmentDirection: { id: 'dept-dir', name: null },
      }),
    ).toEqual({ directionId: 'dept-dir', directionName: null });
  });

  it('returns null when nothing resolves', () => {
    expect(
      resolveEmployeeDisplayedDirection({
        assignmentDirection: null,
        positionDirection: null,
        departmentDirection: null,
      }),
    ).toEqual({ directionId: null, directionName: null });
  });
});
