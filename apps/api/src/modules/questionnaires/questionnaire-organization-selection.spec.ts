import {
  organizationTripleConflictsWithContext,
  organizationTripleHasOrg,
} from './questionnaire-organization-selection';

describe('organizationTripleHasOrg', () => {
  it('is false when all null', () => {
    expect(
      organizationTripleHasOrg({
        directionId: null,
        departmentId: null,
        positionId: null,
      }),
    ).toBe(false);
  });

  it('is true when any id set', () => {
    expect(
      organizationTripleHasOrg({
        directionId: 'd1',
        departmentId: null,
        positionId: null,
      }),
    ).toBe(true);
  });
});

describe('organizationTripleConflictsWithContext', () => {
  it('allows draft org when context has no org', () => {
    expect(
      organizationTripleConflictsWithContext({
        context: {
          directionId: null,
          departmentId: null,
          positionId: null,
        },
        resolved: {
          directionId: 'dir',
          departmentId: 'dep',
          positionId: 'pos',
        },
      }),
    ).toBe(false);
  });

  it('rejects mismatch when context has org', () => {
    expect(
      organizationTripleConflictsWithContext({
        context: {
          directionId: 'dir',
          departmentId: 'dep',
          positionId: 'pos',
        },
        resolved: {
          directionId: 'dir',
          departmentId: 'dep',
          positionId: 'other',
        },
      }),
    ).toBe(true);
  });

  it('accepts exact match when context has org', () => {
    expect(
      organizationTripleConflictsWithContext({
        context: {
          directionId: 'dir',
          departmentId: 'dep',
          positionId: 'pos',
        },
        resolved: {
          directionId: 'dir',
          departmentId: 'dep',
          positionId: 'pos',
        },
      }),
    ).toBe(false);
  });
});
