import { UserRole } from '../../platform/identity/user.enums';
import { pickLegacyOrgAssignmentPatch } from './legacy-org-assignment-patch';

describe('pickLegacyOrgAssignmentPatch', () => {
  const dto = {
    departmentId: 'dept-new',
    positionId: 'pos-new',
  };

  it('admin applies departmentId and positionId', () => {
    expect(pickLegacyOrgAssignmentPatch({ role: UserRole.Admin }, dto)).toEqual(
      dto,
    );
  });

  it('department manager strips org fields (incl. self-profile edits)', () => {
    expect(
      pickLegacyOrgAssignmentPatch({ role: UserRole.DepartmentManager }, dto),
    ).toEqual({});
  });

  it('employee strips org fields', () => {
    expect(
      pickLegacyOrgAssignmentPatch({ role: UserRole.Employee }, dto),
    ).toEqual({});
  });
});
