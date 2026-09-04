import { EntityManager } from 'typeorm';
import { EmploymentAssignmentManagedDepartment } from './employment-assignment-managed-department.entity';
import { PositionManagedDepartment } from '../positions/position-managed-department.entity';
import { Position } from '../positions/position.entity';
import {
  ManagementKind,
  managementKindImpliesManager,
  isManagementKind,
} from '../employment-catalog/management-kind';

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
  managementKind: ManagementKind;
  /** Legacy mirror: kind !== none */
  isDepartmentManager: boolean;
  managedDepartmentIds: string[];
};

/**
 * Resolve leadership for EA create:
 * Position template = default; explicit values override when provided.
 */
export function resolveManagerMembershipForCreate(input: {
  position: Position | null;
  positionManagedDepartmentIds: string[];
  explicitManagementKind?: ManagementKind;
  /** @deprecated prefer explicitManagementKind */
  explicitIsDepartmentManager?: boolean;
  explicitManagedDepartmentIds?: string[];
  assignmentDepartmentId: string | null;
}): ManagerMembershipState {
  let managementKind: ManagementKind;
  if (input.explicitManagementKind !== undefined) {
    managementKind = input.explicitManagementKind;
  } else if (input.explicitIsDepartmentManager !== undefined) {
    managementKind = input.explicitIsDepartmentManager
      ? ManagementKind.Departments
      : ManagementKind.None;
  } else if (input.position?.managementKindTemplate) {
    managementKind = isManagementKind(input.position.managementKindTemplate)
      ? input.position.managementKindTemplate
      : input.position.isDepartmentManagerTemplate
        ? ManagementKind.Departments
        : ManagementKind.None;
  } else {
    managementKind = input.position?.isDepartmentManagerTemplate
      ? ManagementKind.Departments
      : ManagementKind.None;
  }

  const isDepartmentManager = managementKindImpliesManager(managementKind);

  let managedDepartmentIds: string[];
  if (managementKind !== ManagementKind.Departments) {
    managedDepartmentIds = [];
  } else if (input.explicitManagedDepartmentIds !== undefined) {
    managedDepartmentIds = [
      ...new Set(input.explicitManagedDepartmentIds.filter(Boolean)),
    ];
  } else if (input.position) {
    managedDepartmentIds = [...input.positionManagedDepartmentIds];
  } else {
    managedDepartmentIds = [];
  }

  if (
    managementKind === ManagementKind.Departments &&
    managedDepartmentIds.length === 0 &&
    input.assignmentDepartmentId &&
    (input.explicitManagementKind !== undefined ||
      input.explicitIsDepartmentManager !== undefined ||
      input.explicitManagedDepartmentIds !== undefined)
  ) {
    managedDepartmentIds = [input.assignmentDepartmentId];
  }

  return { managementKind, isDepartmentManager, managedDepartmentIds };
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
