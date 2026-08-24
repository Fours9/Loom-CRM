import { didAssignmentHierarchyDrift } from './assignment-hierarchy-drift.policy';

describe('didAssignmentHierarchyDrift', () => {
  const base = {
    candidateCompanyId: null as string | null,
    candidateDirectionId: null as string | null,
    candidateDepartmentId: null as string | null,
    candidatePositionId: null as string | null,
    lockedDirectionCompanyId: undefined as string | null | undefined,
    lockedDepartmentDirectionId: undefined as string | null | undefined,
    lockedPositionDepartmentId: undefined as string | null | undefined,
    discoveryPositionDepartmentId: undefined as string | null | undefined,
    lockedPositionDirectionId: undefined as string | null | undefined,
    discoveryPositionDirectionId: undefined as string | null | undefined,
  };

  it('is false for an all-null create snapshot', () => {
    expect(didAssignmentHierarchyDrift(base)).toBe(false);
  });

  it('is false for direction-only when company stays null', () => {
    expect(
      didAssignmentHierarchyDrift({
        ...base,
        candidateDirectionId: 'd1',
        candidateCompanyId: null,
        lockedDirectionCompanyId: null,
      }),
    ).toBe(false);
  });

  it('is true when locked direction company diverges', () => {
    expect(
      didAssignmentHierarchyDrift({
        ...base,
        candidateDirectionId: 'd1',
        candidateCompanyId: 'c1',
        lockedDirectionCompanyId: 'c2',
      }),
    ).toBe(true);
  });

  it('is true when locked department direction diverges', () => {
    expect(
      didAssignmentHierarchyDrift({
        ...base,
        candidateDirectionId: 'd1',
        candidateDepartmentId: 'dep1',
        lockedDepartmentDirectionId: 'd2',
      }),
    ).toBe(true);
  });

  it('is true when locked position department diverges', () => {
    expect(
      didAssignmentHierarchyDrift({
        ...base,
        candidatePositionId: 'p1',
        discoveryPositionDepartmentId: 'dep1',
        lockedPositionDepartmentId: 'dep2',
        discoveryPositionDirectionId: 'd1',
        lockedPositionDirectionId: 'd1',
      }),
    ).toBe(true);
  });
});
