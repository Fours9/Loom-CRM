import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { EmploymentAssignment } from '../employees/employment-assignment.entity';

export type CurrentEmploymentAssignmentCandidate = {
  id: string;
  employeeId: string;
  status: string;
  startDate: string | null;
};

/**
 * Deterministic order: startDate DESC NULLS LAST, id DESC.
 */
export function compareCurrentEmploymentAssignments(
  a: { startDate: string | null; id: string },
  b: { startDate: string | null; id: string },
): number {
  const aStart = a.startDate ?? '';
  const bStart = b.startDate ?? '';
  if (aStart !== bStart) {
    if (!aStart) return 1;
    if (!bStart) return -1;
    return bStart.localeCompare(aStart);
  }
  return b.id.localeCompare(a.id);
}

/**
 * Pure selection for the current active employment assignment.
 * 1. Prefer currentAssignmentId when the row belongs to the employee and is active
 * 2. Else first active row by startDate DESC NULLS LAST, id DESC
 */
export function selectCurrentEmploymentAssignment(
  candidates: CurrentEmploymentAssignmentCandidate[],
  employeeId: string,
  currentAssignmentId: string | null,
): CurrentEmploymentAssignmentCandidate | null {
  if (currentAssignmentId) {
    const current = candidates.find((c) => c.id === currentAssignmentId);
    if (
      current &&
      current.employeeId === employeeId &&
      current.status === 'active'
    ) {
      return current;
    }
  }

  const active = candidates
    .filter((c) => c.employeeId === employeeId && c.status === 'active')
    .sort(compareCurrentEmploymentAssignments);
  return active[0] ?? null;
}

/**
 * Loads the employee's current active employment_assignment.
 * Prefer employee.currentAssignmentId when verified active; else newest active by startDate.
 */
@Injectable()
export class CurrentEmploymentAssignmentResolver {
  constructor(private readonly dataSource: DataSource) {}

  async resolve(
    employee: { id: string; currentAssignmentId: string | null },
    manager?: EntityManager,
  ): Promise<EmploymentAssignment | null> {
    const repo = (manager ?? this.dataSource.manager).getRepository(
      EmploymentAssignment,
    );

    if (employee.currentAssignmentId) {
      const current = await repo.findOne({
        where: { id: employee.currentAssignmentId },
      });
      if (
        current &&
        current.employeeId === employee.id &&
        current.status === 'active'
      ) {
        return current;
      }
    }

    return (
      (await repo
        .createQueryBuilder('ea')
        .where('ea.employee_id = :employeeId', { employeeId: employee.id })
        .andWhere('ea.status = :status', { status: 'active' })
        .orderBy('ea.start_date', 'DESC', 'NULLS LAST')
        .addOrderBy('ea.id', 'DESC')
        .getOne()) ?? null
    );
  }
}
