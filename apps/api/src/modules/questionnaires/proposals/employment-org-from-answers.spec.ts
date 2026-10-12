import {
  buildEmploymentOrgProposalCandidates,
  extractEmploymentOrgFromAnswers,
  employmentOrgEquals,
  employmentOrgHasAny,
} from './employment-org-from-answers';

describe('employment-org-from-answers', () => {
  it('extracts uuids and ignores blanks', () => {
    expect(
      extractEmploymentOrgFromAnswers({
        'company_work.direction_id': ' dir-1 ',
        'company_work.department_id': '',
        'company_work.position_id': 'pos-1',
      }),
    ).toEqual({
      directionId: 'dir-1',
      departmentId: null,
      positionId: 'pos-1',
    });
  });

  it('builds only changed employment fields', () => {
    const candidates = buildEmploymentOrgProposalCandidates({
      answers: {
        'company_work.direction_id': 'd1',
        'company_work.department_id': 'dep1',
        'company_work.position_id': 'p1',
      },
      current: {
        directionId: 'd1',
        departmentId: null,
        positionId: null,
      },
    });
    expect(candidates.map((c) => c.proposedChanges.field)).toEqual([
      'departmentId',
      'positionId',
    ]);
    expect(candidates[0]?.proposedChanges.labelUa).toBe('Підрозділ');
  });

  it('employmentOrgHasAny / equals helpers', () => {
    expect(
      employmentOrgHasAny({
        directionId: null,
        departmentId: null,
        positionId: null,
      }),
    ).toBe(false);
    expect(
      employmentOrgEquals(
        { directionId: 'a', departmentId: null, positionId: null },
        { directionId: 'a', departmentId: null, positionId: null },
      ),
    ).toBe(true);
  });
});
