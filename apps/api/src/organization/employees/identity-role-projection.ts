import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { User } from '../../platform/identity/user.entity';
import { UserRole } from '../../platform/identity/user.enums';
import { AccountRole } from '../../platform/access-control/account-role.entity';
import { resolveSystemAccountRoleId } from '../../platform/access-control/resolve-system-account-role-id';
import { isBridgeManagedAccountRoleCode } from '@loom/contracts-access-control';
import { SystemAccountRoleCode } from '../../platform/access-control/system-account-role-codes';
import {
  ManagementKind,
  managementKindImpliesManager,
} from '../employment-catalog/management-kind';
import { Employee } from './employee.entity';
import { EmploymentAssignment } from './employment-assignment.entity';
import { CurrentEmploymentAssignmentResolver } from '../employment-catalog/current-employment-assignment.resolver';

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
 * Leadership → system employee/DM bridge only (ADR 0011).
 * Never auto-assigns director/admin from position. No adminAccess toggle.
 */
@Injectable()
export class IdentityRoleProjection {
  constructor(
    private readonly currentAssignment: CurrentEmploymentAssignmentResolver,
  ) {}

  /**
   * Canonicalize system employee/DM account role from active EA leadership.
   * Preserves director / admin / custom / adminEquivalent assignments.
   * When user is null, only mirrors Employee.role from leadership.
   *
   * Caller owns tokenVersion++ coordination when combining with assign TX —
   * this method bumps tokenVersion when it changes accountRoleId/role.
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

    const activeEa = await this.currentAssignment.resolve(
      {
        id: employee.id,
        currentAssignmentId: employee.currentAssignmentId,
      },
      manager,
    );

    const oldRole = (user?.role ?? employee.role) as UserRole;
    const oldAccountRoleId = user?.accountRoleId ?? null;

    const currentAccountRole = user?.accountRoleId
      ? await roleRepo.findOne({ where: { id: user.accountRoleId } })
      : null;

    const bridgeable = this.isBridgeableAccountRole(currentAccountRole);
    const desiredSystemCode = this.desiredBridgeCode(activeEa);
    const desiredMirror = this.mirrorRoleForSystemCode(desiredSystemCode);

    if (!user) {
      const newRole = desiredMirror;
      let changed = false;
      if (employee.role !== newRole) {
        employee.role = newRole;
        await employeeRepo.save(employee);
        changed = true;
      }
      return {
        oldRole,
        newRole,
        oldAccountRoleId: null,
        newAccountRoleId: null,
        changed,
      };
    }

    if (!bridgeable) {
      const mirror = currentAccountRole
        ? compatibilityUserRoleFromAccountRole(currentAccountRole)
        : oldRole;
      let changed = false;
      employee.role = mirror;
      await employeeRepo.save(employee);
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

    const targetRoleId = await resolveSystemAccountRoleId(
      manager,
      desiredSystemCode,
    );
    let changed = false;
    if (
      user.accountRoleId !== targetRoleId ||
      user.role !== desiredMirror ||
      employee.role !== desiredMirror
    ) {
      user.accountRoleId = targetRoleId;
      user.role = desiredMirror;
      if (bump) user.tokenVersion = (user.tokenVersion ?? 0) + 1;
      await userRepo.save(user);
      employee.role = desiredMirror;
      await employeeRepo.save(employee);
      changed = true;
    }

    return {
      oldRole,
      newRole: desiredMirror,
      oldAccountRoleId,
      newAccountRoleId: targetRoleId,
      changed,
    };
  }

  isBridgeableAccountRole(role: AccountRole | null): boolean {
    if (!role) return true;
    if (role.isAdminEquivalent) return false;
    if (!role.isSystem || !role.code) return false;
    return isBridgeManagedAccountRoleCode(role.code);
  }

  desiredBridgeCode(
    activeEa: EmploymentAssignment | null,
  ):
    | typeof SystemAccountRoleCode.Employee
    | typeof SystemAccountRoleCode.DepartmentManager {
    const kind =
      (activeEa?.managementKind as ManagementKind | undefined) ??
      (activeEa?.isDepartmentManager
        ? ManagementKind.Departments
        : ManagementKind.None);
    if (managementKindImpliesManager(kind)) {
      return SystemAccountRoleCode.DepartmentManager;
    }
    return SystemAccountRoleCode.Employee;
  }

  mirrorRoleForSystemCode(
    code:
      | typeof SystemAccountRoleCode.Employee
      | typeof SystemAccountRoleCode.DepartmentManager,
  ): UserRole {
    return code === SystemAccountRoleCode.DepartmentManager
      ? UserRole.DepartmentManager
      : UserRole.Employee;
  }
}
