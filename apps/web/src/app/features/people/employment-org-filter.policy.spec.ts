import {
  filterDepartmentsForSelection,
  filterPositionsForSelection,
  reduceEmploymentOrgFilter,
} from './employment-org-filter.policy';

const catalogs = {
  directions: [
    { id: 'dir-a', name: 'A', code: null, companyId: 'company-1' },
    { id: 'dir-b', name: 'B', code: null, companyId: 'company-1' },
  ],
  departments: [
    {
      id: 'dep-a',
      name: 'Dept A',
      description: null,
      location: null,
      directionId: 'dir-a',
    },
    {
      id: 'dep-b',
      name: 'Dept B',
      description: null,
      location: null,
      directionId: 'dir-b',
    },
  ],
  positions: [
    { id: 'pos-a', name: 'Pos A', departmentId: 'dep-a', directionId: 'dir-a' },
    { id: 'pos-b', name: 'Pos B', departmentId: 'dep-b', directionId: 'dir-b' },
  ],
};

describe('employment-org-filter.policy', () => {
  it('clears incompatible department and position after direction change', () => {
    const next = reduceEmploymentOrgFilter(
      {
        directionId: 'dir-a',
        departmentId: 'dep-a',
        positionId: 'pos-a',
      },
      { type: 'selectDirection', directionId: 'dir-b' },
      catalogs,
    );

    expect(next).toEqual({
      directionId: 'dir-b',
      departmentId: null,
      positionId: null,
    });
  });

  it('autofills direction from department and clears incompatible position', () => {
    const next = reduceEmploymentOrgFilter(
      {
        directionId: null,
        departmentId: null,
        positionId: 'pos-a',
      },
      { type: 'selectDepartment', departmentId: 'dep-b' },
      catalogs,
    );

    expect(next).toEqual({
      directionId: 'dir-b',
      departmentId: 'dep-b',
      positionId: null,
    });
  });

  it('autofills department and direction from position', () => {
    const next = reduceEmploymentOrgFilter(
      {
        directionId: null,
        departmentId: null,
        positionId: null,
      },
      { type: 'selectPosition', positionId: 'pos-a' },
      catalogs,
    );

    expect(next).toEqual({
      directionId: 'dir-a',
      departmentId: 'dep-a',
      positionId: 'pos-a',
    });
  });

  it('filters departments and positions from current selection', () => {
    expect(
      filterDepartmentsForSelection(
        { directionId: 'dir-a', departmentId: null, positionId: null },
        catalogs.departments,
      ).map((item) => item.id),
    ).toEqual(['dep-a']);

    expect(
      filterPositionsForSelection(
        { directionId: 'dir-b', departmentId: 'dep-b', positionId: null },
        catalogs.positions,
      ).map((item) => item.id),
    ).toEqual(['pos-b']);
  });
});
