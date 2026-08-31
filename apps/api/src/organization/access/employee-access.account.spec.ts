import { UserRole, UserStatus } from '../../platform/identity/user.enums';
import type { User } from '../../platform/identity/user.entity';
import type { Employee } from '../employees/employee.entity';
import { EmployeeAccessService } from './employee-access.service';

function user(partial: Partial<User> & Pick<User, 'id' | 'role'>): User {
  return {
    email: `${partial.id}@example.com`,
    status: UserStatus.Active,
    isDepartmentManager: false,
    mustChangePassword: false,
    tokenVersion: 0,
    passwordHash: 'x',
    passwordChangedAt: null,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...partial,
  } as User;
}

function employee(
  partial: Partial<Employee> & Pick<Employee, 'id'>,
): Employee {
  return {
    userId: null,
    employeeNumber: 'E-001',
    firstName: 'A',
    lastName: 'B',
    ...partial,
  } as Employee;
}

describe('EmployeeAccessService account predicates', () => {
  const access = Object.create(EmployeeAccessService.prototype) as EmployeeAccessService;

  const admin = user({ id: 'admin-1', role: UserRole.Admin });
  const manager = user({
    id: 'mgr-1',
    role: UserRole.DepartmentManager,
    isDepartmentManager: true,
  });

  it('canResetEmployeePassword requires admin + target account', () => {
    expect(
      access.canResetEmployeePassword(
        admin,
        employee({ id: 'e1', userId: 'u1' }),
      ),
    ).toBe(true);
    expect(
      access.canResetEmployeePassword(admin, employee({ id: 'e1', userId: null })),
    ).toBe(false);
    expect(
      access.canResetEmployeePassword(
        manager,
        employee({ id: 'e1', userId: 'u1' }),
      ),
    ).toBe(false);
  });

  it('admin can reset own password', () => {
    expect(
      access.canResetEmployeePassword(
        admin,
        employee({ id: 'e-self', userId: admin.id }),
      ),
    ).toBe(true);
  });

  it('canDestructivelyManageAccount bans self', () => {
    expect(
      access.canDestructivelyManageAccount(
        admin,
        employee({ id: 'e2', userId: 'u2' }),
      ),
    ).toBe(true);
    expect(
      access.canDestructivelyManageAccount(
        admin,
        employee({ id: 'e-self', userId: admin.id }),
      ),
    ).toBe(false);
  });

  it('canDeleteEmployee bans self; managers cannot', () => {
    expect(
      access.canDeleteEmployee(admin, employee({ id: 'e3', userId: 'u3' })),
    ).toBe(true);
    expect(
      access.canDeleteEmployee(
        admin,
        employee({ id: 'e-self', userId: admin.id }),
      ),
    ).toBe(false);
    expect(
      access.canDeleteEmployee(manager, employee({ id: 'e3', userId: 'u3' })),
    ).toBe(false);
  });

  it('canDeleteEmployee allows admin when target has no account', () => {
    expect(
      access.canDeleteEmployee(admin, employee({ id: 'e4', userId: null })),
    ).toBe(true);
  });
});
