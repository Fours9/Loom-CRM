import { canMutateEmployeeOrgAssignment } from './can-mutate-employee-org-assignment.policy';

describe('canMutateEmployeeOrgAssignment', () => {
  it('allows adminEquivalent only', () => {
    expect(canMutateEmployeeOrgAssignment({ isAdminEquivalent: true })).toBe(
      true,
    );
    expect(canMutateEmployeeOrgAssignment({ isAdminEquivalent: false })).toBe(
      false,
    );
  });
});
