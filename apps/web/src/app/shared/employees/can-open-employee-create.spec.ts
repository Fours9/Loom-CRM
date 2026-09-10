import { Permission } from '@loom/contracts-auth';
import { canOpenEmployeeCreate } from './can-open-employee-create';

describe('canOpenEmployeeCreate', () => {
  it('requires Create and View', () => {
    const perms = new Set<string>();
    const session = {
      hasPermission: (p: Permission) => perms.has(p),
    };
    expect(canOpenEmployeeCreate(session)).toBe(false);
    perms.add(Permission.EmployeesCreate);
    expect(canOpenEmployeeCreate(session)).toBe(false);
    perms.add(Permission.EmployeesView);
    expect(canOpenEmployeeCreate(session)).toBe(true);
  });
});
