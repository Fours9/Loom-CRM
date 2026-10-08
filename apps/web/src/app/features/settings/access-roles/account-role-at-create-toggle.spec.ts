/**
 * Mirrors Settings dialog TOGGLE_EXTRAS strip/re-add for create_account_at_create.
 * Full AccountRolesService.update also bumps users.token_version when extras change.
 */
const TOGGLE_EXTRAS = [
  'confidential.view',
  'employees.create',
  'employees.manage_profiles',
  'employees.assign_account_role',
  'employees.create_account_at_create',
  'absences.approve',
  'absences.admin',
] as const;

const AT_CREATE = 'employees.create_account_at_create';

describe('account-role AtCreate toggle extras', () => {
  it('strips AtCreate when toggle OFF and keeps unrelated extras', () => {
    const existing = [
      'documents.view',
      AT_CREATE,
      'employees.create',
    ];
    const extras = new Set(
      existing.filter((p) => !(TOGGLE_EXTRAS as readonly string[]).includes(p)),
    );
    const grantsCreateAccountAtCreate = false;
    if (grantsCreateAccountAtCreate) extras.add(AT_CREATE);
    expect([...extras].sort()).toEqual(['documents.view'].sort());
  });

  it('re-adds AtCreate when toggle ON', () => {
    const existing = ['documents.view', AT_CREATE];
    const extras = new Set(
      existing.filter((p) => !(TOGGLE_EXTRAS as readonly string[]).includes(p)),
    );
    extras.add(AT_CREATE);
    expect(extras.has(AT_CREATE)).toBe(true);
    expect(extras.has('documents.view')).toBe(true);
  });
});
