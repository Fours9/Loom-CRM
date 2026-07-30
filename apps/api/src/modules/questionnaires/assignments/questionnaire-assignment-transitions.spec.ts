import {
  canCancelAssignment,
  canCloseAssignment,
  canReactivateAssignment,
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

  it('canReactivateAssignment only for cancelled', () => {
    expect(canReactivateAssignment('cancelled')).toBe(true);
    expect(canReactivateAssignment('assigned')).toBe(false);
    expect(canReactivateAssignment('reviewed')).toBe(false);
  });
});
