import {
  emptyEmployeeCreateDraft,
  generateTemporaryPassword,
  normalizeEmployeeCreateDraft,
  validateEmployeeCreateDraft,
} from './employee-create-draft';

describe('employee-create-draft', () => {
  it('sets createAccount from canCreateAccount', () => {
    expect(emptyEmployeeCreateDraft({ canCreateAccount: false }).createAccount)
      .toBe(false);
    expect(emptyEmployeeCreateDraft({ canCreateAccount: true }).createAccount)
      .toBe(true);
  });

  it('does not default temporary password', () => {
    expect(emptyEmployeeCreateDraft({ canCreateAccount: true }).temporaryPassword)
      .toBe('');
    expect(generateTemporaryPassword()).not.toBe('TempPass123!');
  });

  it('validates required names and account fields', () => {
    const draft = emptyEmployeeCreateDraft({ canCreateAccount: true });
    expect(validateEmployeeCreateDraft(draft)).toBe('required_names');
    draft.firstName = 'Іван';
    draft.lastName = 'Тест';
    expect(validateEmployeeCreateDraft(draft)).toBe('account_email_required');
    draft.email = 'a@b.c';
    expect(validateEmployeeCreateDraft(draft)).toBe('account_password_required');
    draft.temporaryPassword = 'short';
    expect(validateEmployeeCreateDraft(draft)).toBe('account_password_short');
    draft.temporaryPassword = 'longenough';
    expect(validateEmployeeCreateDraft(draft)).toBeNull();
  });

  it('keeps createAccount=true in normalize (backend fail-closed)', () => {
    const draft = emptyEmployeeCreateDraft({ canCreateAccount: true });
    draft.firstName = 'A';
    draft.lastName = 'B';
    draft.createAccount = true;
    draft.email = 'x@y.z';
    draft.temporaryPassword = 'abcdefgh';
    const body = normalizeEmployeeCreateDraft(draft);
    expect(body.createAccount).toBe(true);
    expect(body.email).toBe('x@y.z');
  });

  it('normalizes directionId and optional accountRoleId', () => {
    const draft = emptyEmployeeCreateDraft({ canCreateAccount: true });
    draft.firstName = 'A';
    draft.lastName = 'B';
    draft.createAccount = true;
    draft.email = 'x@y.z';
    draft.temporaryPassword = 'abcdefgh';
    draft.directionId = 'dir-1';
    draft.departmentId = 'dep-1';
    draft.positionId = 'pos-1';
    draft.accountRoleId = 'role-1';
    draft.managementKind = 'departments';
    const body = normalizeEmployeeCreateDraft(draft);
    expect(body.directionId).toBe('dir-1');
    expect(body.departmentId).toBe('dep-1');
    expect(body.positionId).toBe('pos-1');
    expect(body.accountRoleId).toBe('role-1');
    expect(body.managementKind).toBe('departments');
  });

  it('sends accountRoleId for numbering even when createAccount=false', () => {
    const draft = emptyEmployeeCreateDraft({ canCreateAccount: true });
    draft.firstName = 'A';
    draft.lastName = 'B';
    draft.createAccount = false;
    draft.accountRoleId = 'role-admin';
    draft.managementKind = 'none';
    const body = normalizeEmployeeCreateDraft(draft);
    expect(body.createAccount).toBe(false);
    expect(body.accountRoleId).toBe('role-admin');
    expect(body.email).toBeUndefined();
    expect(body.temporaryPassword).toBeUndefined();
  });

  it('omits credentials when createAccount=false but keeps managementKind', () => {
    const draft = emptyEmployeeCreateDraft({ canCreateAccount: true });
    draft.firstName = 'A';
    draft.lastName = 'B';
    draft.createAccount = false;
    draft.email = 'should-not-send';
    draft.temporaryPassword = 'abcdefgh';
    draft.managementKind = 'direction';
    const body = normalizeEmployeeCreateDraft(draft);
    expect(body.createAccount).toBe(false);
    expect(body.email).toBeUndefined();
    expect(body.temporaryPassword).toBeUndefined();
    expect(body.managementKind).toBe('direction');
  });
});
