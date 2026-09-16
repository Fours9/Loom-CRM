import { Permission } from './permission.names';
import { permissionsForPreset } from './role-permissions';

describe('role-permissions create_account_at_create', () => {
  it('is in admin preset only', () => {
    expect(permissionsForPreset('admin')).toContain(
      Permission.EmployeesCreateAccountAtCreate,
    );
    expect(permissionsForPreset('department_manager')).not.toContain(
      Permission.EmployeesCreateAccountAtCreate,
    );
    expect(permissionsForPreset('employee')).not.toContain(
      Permission.EmployeesCreateAccountAtCreate,
    );
  });
});
