import { EntityManager } from 'typeorm';
import { EmploymentAssignmentManagedDepartment } from './employment-assignment-managed-department.entity';
import { PositionManagedDepartment } from '../positions/position-managed-department.entity';
import { Position } from '../positions/position.entity';

/** Replace EA managed department join rows in the same TX. */
export async function replaceAssignmentManagedDepartments(
  manager: EntityManager,
  assignmentId: string,
  departmentIds: string[],
): Promise<void> {
  const repo = manager.getRepository(EmploymentAssignmentManagedDepartment);
  await repo.delete({ assignmentId });
  const unique = [...new Set(departmentIds.filter(Boolean))];
  if (!unique.length) return;
  await repo.save(
    unique.map((departmentId) =>
      repo.create({ assignmentId, departmentId }),
    ),
  );
}

export async function replacePositionManagedDepartments(
  manager: EntityManager,
  positionId: string,
  departmentIds: string[],
): Promise<void> {
  const repo = manager.getRepository(PositionManagedDepartment);
  await repo.delete({ positionId });
  const unique = [...new Set(departmentIds.filter(Boolean))];
  if (!unique.length) return;
  await repo.save(
    unique.map((departmentId) =>
      repo.create({ positionId, departmentId }),
    ),
  );
}

export type ManagerMembershipState = {
  isDepartmentManager: boolean;
  managedDepartmentIds: string[];
};

/**
 * Resolve manager membership for EA create:
 * Position template = default; explicit values override when provided.
 */
export function resolveManagerMembershipForCreate(input: {
  position: Position | null;
  positionManagedDepartmentIds: string[];
  explicitIsDepartmentManager?: boolean;
  explicitManagedDepartmentIds?: string[];
  /** Department of the assignment — used for UI default when enabling manager with empty list. */
  assignmentDepartmentId: string | null;
}): ManagerMembershipState {
  const hasExplicitManager = input.explicitIsDepartmentManager !== undefined;
  const hasExplicitDepts = input.explicitManagedDepartmentIds !== undefined;

  let isDepartmentManager = hasExplicitManager
    ? Boolean(input.explicitIsDepartmentManager)
    : Boolean(input.position?.isDepartmentManagerTemplate);

  let managedDepartmentIds: string[];
  if (hasExplicitDepts) {
    managedDepartmentIds = [...new Set(input.explicitManagedDepartmentIds!.filter(Boolean))];
  } else if (isDepartmentManager && input.position) {
    managedDepartmentIds = [...input.positionManagedDepartmentIds];
  } else {
    managedDepartmentIds = [];
  }

  if (!isDepartmentManager) {
    managedDepartmentIds = [];
  } else if (
    managedDepartmentIds.length === 0 &&
    input.assignmentDepartmentId &&
    (hasExplicitManager || hasExplicitDepts)
  ) {
    // New UI action: enable manager with empty list → default [departmentId]
    managedDepartmentIds = [input.assignmentDepartmentId];
  }

  return { isDepartmentManager, managedDepartmentIds };
}

export async function loadPositionManagerTemplate(
  manager: EntityManager,
  positionId: string | null,
): Promise<{
  position: Position | null;
  managedDepartmentIds: string[];
}> {
  if (!positionId) {
    return { position: null, managedDepartmentIds: [] };
  }
  const position = await manager.getRepository(Position).findOne({
    where: { id: positionId },
    lock: { mode: 'pessimistic_write' },
  });
  if (!position) {
    return { position: null, managedDepartmentIds: [] };
  }
  const rows = await manager.getRepository(PositionManagedDepartment).find({
    where: { positionId },
  });
  return {
    position,
    managedDepartmentIds: rows.map((r) => r.departmentId),
  };
}
