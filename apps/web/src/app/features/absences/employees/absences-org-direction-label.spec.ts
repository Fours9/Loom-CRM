import { resolveAbsencesOrgDirectionLabel } from './absences-org-direction-label';

describe('resolveAbsencesOrgDirectionLabel', () => {
  const departments = [
    {
      id: 'd1',
      directionId: 'dir-a',
      directionName: 'Напрямок A',
    },
  ];
  const positions = [
    { id: 'p1', directionId: 'dir-a', directionName: 'Напрямок A' },
    { id: 'p2', directionId: null, directionName: null },
  ];

  it('prefers position directionName', () => {
    expect(
      resolveAbsencesOrgDirectionLabel({
        departmentId: 'd1',
        positionId: 'p1',
        departments,
        positions,
      }),
    ).toBe('Напрямок A');
  });

  it('falls back to department directionName', () => {
    expect(
      resolveAbsencesOrgDirectionLabel({
        departmentId: 'd1',
        positionId: 'p2',
        departments,
        positions,
      }),
    ).toBe('Напрямок A');
  });

  it('returns null when unknown', () => {
    expect(
      resolveAbsencesOrgDirectionLabel({
        departmentId: null,
        positionId: null,
        departments,
        positions,
      }),
    ).toBeNull();
  });
});
