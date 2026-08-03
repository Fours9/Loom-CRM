import {
  canAttachAssignment,
  canCancelAssignment,
  canCloseAssignment,
} from './questionnaire-assignment-transitions';

describe('questionnaire-assignment-transitions', () => {
  it.each([
    'assigned',
    'in_progress',
    'submitted',
    'changes_requested',
    'reviewed',
  ] as const)('canCancelAssignment(%s) is true', (status) => {
    expect(canCancelAssignment(status)).toBe(true);
  });

  it('canCancelAssignment(cancelled) is false', () => {
    expect(canCancelAssignment('cancelled')).toBe(false);
  });

  it('canCloseAssignment covers cancelled but not closed', () => {
    expect(canCloseAssignment('reviewed')).toBe(true);
    expect(canCloseAssignment('cancelled')).toBe(true);
    expect(canCloseAssignment('closed')).toBe(false);
  });

  it('does not treat unknown future statuses as cancellable', () => {
    expect(canCancelAssignment('archived')).toBe(false);
  });

  describe('canAttachAssignment', () => {
    it('allows attaching a brand-new unattached assignment', () => {
      expect(
        canAttachAssignment({
          status: 'new',
          employeeId: null,
          detachedFromEmployeeId: null,
        }),
      ).toBe(true);
    });

    it('refuses new assignment that is somehow already linked', () => {
      expect(
        canAttachAssignment({
          status: 'new',
          employeeId: 'emp-1',
          detachedFromEmployeeId: null,
        }),
      ).toBe(false);
    });

    it('allows re-attaching a cancelled assignment to its detached employee', () => {
      expect(
        canAttachAssignment({
          status: 'cancelled',
          employeeId: null,
          detachedFromEmployeeId: 'emp-1',
        }),
      ).toBe(true);
    });

    it('refuses a legacy cancelled assignment still carrying employeeId', () => {
      expect(
        canAttachAssignment({
          status: 'cancelled',
          employeeId: 'emp-1',
          detachedFromEmployeeId: null,
        }),
      ).toBe(false);
    });

    it('refuses cancelled without a recorded detachedFromEmployeeId', () => {
      expect(
        canAttachAssignment({
          status: 'cancelled',
          employeeId: null,
          detachedFromEmployeeId: null,
        }),
      ).toBe(false);
    });

    it('refuses other statuses', () => {
      for (const status of [
        'assigned',
        'in_progress',
        'submitted',
        'changes_requested',
        'reviewed',
        'closed',
      ] as const) {
        expect(
          canAttachAssignment({
            status,
            employeeId: 'emp-1',
            detachedFromEmployeeId: null,
          }),
        ).toBe(false);
      }
    });
  });
});
