import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { User } from '../../platform/identity/user.entity';
import { UserRole } from '../../platform/identity/user.enums';
import { AccountRole } from '../../platform/access-control/account-role.entity';
import { Employee } from './employee.entity';

export function compatibilityUserRoleFromAccountRole(
  role: AccountRole,
): UserRole {
  if (role.isAdminEquivalent || role.permissionPreset === 'admin') {
    return UserRole.Admin;
  }
  if (role.permissionPreset === 'department_manager') {
    return UserRole.DepartmentManager;
  }
  return UserRole.Employee;
}

/**
 * Syncs legacy `User.role` / `Employee.role` mirrors from AccountRole.
 * Does **not** rewrite `users.account_role_id` from employment leadership
 * (ADR 0011 — AccountRole is independent access SoT).
 */
@Injectable()
export class IdentityRoleProjection {
  /**
   * Mirror UserRole from the employee's current AccountRole.
   * No-op when there is no User (AccountRole lives on User).
   *
   * Caller owns tokenVersion++ when combining with assign TX —
   * this method bumps tokenVersion when it changes role mirrors.
   */
  async apply(
    manager: EntityManager,
    employee: Employee,
    options?: { bumpTokenVersion?: boolean },
  ): Promise<{
    oldRole: UserRole;
    newRole: UserRole;
    oldAccountRoleId: string | null;
    newAccountRoleId: string | null;
    changed: boolean;
  }> {
    const bump = options?.bumpTokenVersion !== false;
    const employeeRepo = manager.getRepository(Employee);
    const userRepo = manager.getRepository(User);
    const roleRepo = manager.getRepository(AccountRole);

    let user: User | null = null;
    if (employee.userId) {
      user = await userRepo.findOne({
        where: { id: employee.userId },
        lock: { mode: 'pessimistic_write' },
      });
    }

    const oldRole = (user?.role ?? employee.role) as UserRole;
    const oldAccountRoleId = user?.accountRoleId ?? null;

    if (!user) {
      return {
        oldRole,
        newRole: oldRole,
        oldAccountRoleId: null,
        newAccountRoleId: null,
        changed: false,
      };
    }

    const currentAccountRole = user.accountRoleId
      ? await roleRepo.findOne({ where: { id: user.accountRoleId } })
      : null;

    if (!currentAccountRole) {
      return {
        oldRole,
        newRole: oldRole,
        oldAccountRoleId,
        newAccountRoleId: oldAccountRoleId,
        changed: false,
      };
    }

    const mirror = compatibilityUserRoleFromAccountRole(currentAccountRole);
    let changed = false;
    if (employee.role !== mirror) {
      employee.role = mirror;
      await employeeRepo.save(employee);
      changed = true;
    }
    if (user.role !== mirror) {
      user.role = mirror;
      if (bump) user.tokenVersion = (user.tokenVersion ?? 0) + 1;
      await userRepo.save(user);
      changed = true;
    }

    return {
      oldRole,
      newRole: mirror,
      oldAccountRoleId,
      newAccountRoleId: oldAccountRoleId,
      changed,
    };
  }
}
