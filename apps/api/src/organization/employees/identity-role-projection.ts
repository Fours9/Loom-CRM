import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { User } from '../../platform/identity/user.entity';
import { UserRole } from '../../platform/identity/user.enums';
import { Employee } from './employee.entity';
import { EmploymentAssignment } from './employment-assignment.entity';
import { CurrentEmploymentAssignmentResolver } from '../employment-catalog/current-employment-assignment.resolver';

export type IdentityRoleAdminAccess = 'preserve' | boolean;

/**
 * Sole writer for User.role (if User exists) and Employee.role mirror.
 * Non-admin roles are derived from active EA.isDepartmentManager.
 */
@Injectable()
export class IdentityRoleProjection {
  constructor(
    private readonly currentAssignment: CurrentEmploymentAssignmentResolver,
  ) {}

  async apply(
    manager: EntityManager,
    employee: Employee,
    options: { adminAccess: IdentityRoleAdminAccess },
  ): Promise<{ oldRole: UserRole; newRole: UserRole }> {
    const employeeRepo = manager.getRepository(Employee);
    const userRepo = manager.getRepository(User);

    let user: User | null = null;
    if (employee.userId) {
      user = await userRepo.findOne({
        where: { id: employee.userId },
        lock: { mode: 'pessimistic_write' },
      });
    }

    const currentRole = (user?.role ?? employee.role) as UserRole;
    const activeEa = await this.currentAssignment.resolve(
      {
        id: employee.id,
        currentAssignmentId: employee.currentAssignmentId,
      },
      manager,
    );

    const newRole = this.deriveRole({
      adminAccess: options.adminAccess,
      currentRole,
      activeEa,
    });

    const oldRole = currentRole;

    employee.role = newRole;
    await employeeRepo.save(employee);

    if (user) {
      if (user.role !== newRole) {
        user.role = newRole;
        user.tokenVersion = (user.tokenVersion ?? 0) + 1;
        await userRepo.save(user);
      } else if (employee.role !== newRole) {
        // already synced above
      }
    }

    return { oldRole, newRole };
  }

  deriveRole(input: {
    adminAccess: IdentityRoleAdminAccess;
    currentRole: UserRole;
    activeEa: EmploymentAssignment | null;
  }): UserRole {
    const { adminAccess, currentRole, activeEa } = input;

    if (adminAccess === true) {
      return UserRole.Admin;
    }
    if (adminAccess === 'preserve' && currentRole === UserRole.Admin) {
      return UserRole.Admin;
    }
    // adminAccess === false, or preserve with non-admin
    if (activeEa?.isDepartmentManager) {
      return UserRole.DepartmentManager;
    }
    return UserRole.Employee;
  }
}
