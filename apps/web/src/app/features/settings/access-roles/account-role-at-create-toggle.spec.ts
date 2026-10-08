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
  'employees.read_team_comment',
  'employees.export_profile',
  'employees.read.personal',
  'employees.write.personal',
  'employees.read.emergency_contact',
  'employees.write.emergency_contact',
  'employees.change_assignment',
  'employees.change_status',
  'employees.view_history',
  'absences.approve',
  'absences.admin',
] as const;

const AT_CREATE = 'employees.create_account_at_create';
const WRITE_PERSONAL = 'employees.write.personal';

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

  it('does not grant write.personal without ManageProfiles', () => {
    const existing = [WRITE_PERSONAL, 'documents.view'];
    const extras = new Set(
      existing.filter((p) => !(TOGGLE_EXTRAS as readonly string[]).includes(p)),
    );
    const grantsManageProfiles = false;
    const grantsWritePersonal = true;
    if (grantsManageProfiles && grantsWritePersonal) {
      extras.add(WRITE_PERSONAL);
    }
    expect(extras.has(WRITE_PERSONAL)).toBe(false);
    expect(extras.has('documents.view')).toBe(true);
  });
});
