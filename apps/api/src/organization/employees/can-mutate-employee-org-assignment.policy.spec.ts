import { UserRole } from '../../platform/identity/user.enums';
import { canMutateEmployeeOrgAssignment } from './can-mutate-employee-org-assignment.policy';

describe('canMutateEmployeeOrgAssignment', () => {
  it('allows admin', () => {
    expect(canMutateEmployeeOrgAssignment({ role: UserRole.Admin })).toBe(true);
  });

  it('denies department manager', () => {
    expect(
      canMutateEmployeeOrgAssignment({ role: UserRole.DepartmentManager }),
    ).toBe(false);
  });

  it('denies employee', () => {
    expect(canMutateEmployeeOrgAssignment({ role: UserRole.Employee })).toBe(
      false,
    );
  });
});
