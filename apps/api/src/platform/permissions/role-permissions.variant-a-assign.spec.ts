import { Permission } from './permission.names';
import { permissionsForPreset } from './role-permissions';

describe('role-permissions Variant A Assign', () => {
  it('does not include questionnaires.assign in department_manager preset', () => {
    expect(permissionsForPreset('department_manager')).not.toContain(
      Permission.QuestionnairesAssign,
    );
  });

  it('keeps questionnaires.assign in admin preset', () => {
    expect(permissionsForPreset('admin')).toContain(
      Permission.QuestionnairesAssign,
    );
  });
});
