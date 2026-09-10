import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { resolveEmployeeNumberPrefixFromAccountRole } from '@loom/contracts-access-control';
import { Employee } from './employee.entity';
import type { ManagerMembershipState } from './managed-department-writes';
import { ManagementKind } from '../employment-catalog/management-kind';

export type EmployeeNumberPrefix = 'E' | 'M' | 'A';

/** Prefix from resolved membership (same Position snapshot as EA). */
export function employeeNumberPrefixFromMembership(
  membership: ManagerMembershipState,
): EmployeeNumberPrefix {
  return membership.managementKind !== ManagementKind.None ? 'M' : 'E';
}

/**
 * Create-time numbering SoT (single entry):
 * 1) explicit AccountRole intent → A/M/E (shared contracts policy)
 * 2) else EA membership / managementKind → M/E
 *
 * AccountRole still does not write managementKind (ADR 0011).
 */
export function employeeNumberPrefixForCreate(input: {
  accountRole: { code: string | null; isAdminEquivalent: boolean } | null;
  membership: ManagerMembershipState;
}): EmployeeNumberPrefix {
  if (input.accountRole) {
    const fromRole = resolveEmployeeNumberPrefixFromAccountRole(
      input.accountRole,
    );
    if (fromRole) return fromRole;
  }
  return employeeNumberPrefixFromMembership(input.membership);
}

/**
 * Actor-agnostic employee number allocation / peek.
 * Call allocate only inside an already-authorized create TX after
 * membership → prefix derivation; hold advisory lock per prefix.
 */
@Injectable()
export class EmployeeNumberAllocator {
  async allocate(
    manager: EntityManager,
    prefix: EmployeeNumberPrefix,
  ): Promise<string> {
    await this.advisoryLock(manager, prefix);
    return this.nextNumber(manager, prefix);
  }

  async peekNext(
    manager: EntityManager,
    prefix: EmployeeNumberPrefix,
  ): Promise<string> {
    return this.nextNumber(manager, prefix);
  }

  private async advisoryLock(
    manager: EntityManager,
    prefix: EmployeeNumberPrefix,
  ): Promise<void> {
    await manager.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
      `employee_number:${prefix}`,
    ]);
  }

  private async nextNumber(
    manager: EntityManager,
    prefix: EmployeeNumberPrefix,
  ): Promise<string> {
    const rows = await manager
      .getRepository(Employee)
      .createQueryBuilder('e')
      .select('e.employee_number', 'employeeNumber')
      .where('e.employee_number LIKE :pattern', { pattern: `${prefix}-%` })
      .getRawMany<{ employeeNumber: string }>();
    let max = 0;
    for (const row of rows) {
      const m = String(row.employeeNumber).match(
        new RegExp(`^${prefix}-(\\d+)$`),
      );
      if (m) max = Math.max(max, Number(m[1]));
    }
    return `${prefix}-${String(max + 1).padStart(3, '0')}`;
  }
}
