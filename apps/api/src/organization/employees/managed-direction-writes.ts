import { EntityManager } from 'typeorm';
import { EmploymentAssignmentManagedDirection } from './employment-assignment-managed-direction.entity';
import { PositionManagedDirection } from '../positions/position-managed-direction.entity';
import { ManagementKind } from '../employment-catalog/management-kind';

/** Replace EA managed direction join rows in the same TX. */
export async function replaceAssignmentManagedDirections(
  manager: EntityManager,
  assignmentId: string,
  directionIds: string[],
): Promise<void> {
  const repo = manager.getRepository(EmploymentAssignmentManagedDirection);
  await repo.delete({ assignmentId });
  const unique = [...new Set(directionIds.filter(Boolean))];
  if (!unique.length) return;
  await repo.save(
    unique.map((directionId) => repo.create({ assignmentId, directionId })),
  );
}

export async function replacePositionManagedDirections(
  manager: EntityManager,
  positionId: string,
  directionIds: string[],
): Promise<void> {
  const repo = manager.getRepository(PositionManagedDirection);
  await repo.delete({ positionId });
  const unique = [...new Set(directionIds.filter(Boolean))];
  if (!unique.length) return;
  await repo.save(
    unique.map((directionId) => repo.create({ positionId, directionId })),
  );
}

/**
 * Single entry for Position / EA `direction` leadership selection.
 * Empty list is invalid at the write boundary when kind is direction —
 * callers must reject or supply a fallback before persist.
 */
export function resolveManagedDirectionIds(input: {
  managementKind: ManagementKind;
  managedDirectionIds?: string[];
  fallbackDirectionId: string | null;
  previousManagedDirectionIds: string[];
  kindExplicitlyEnabled: boolean;
}): string[] {
  if (input.managementKind !== ManagementKind.Direction) {
    return [];
  }

  let ids: string[];
  if (input.managedDirectionIds !== undefined) {
    ids = [...new Set(input.managedDirectionIds.filter(Boolean))];
  } else if (input.kindExplicitlyEnabled) {
    ids = [];
  } else {
    ids = [...input.previousManagedDirectionIds];
  }

  if (ids.length === 0 && input.fallbackDirectionId) {
    return [input.fallbackDirectionId];
  }
  return ids;
}

export async function loadPositionManagedDirectionIds(
  manager: EntityManager,
  positionId: string | null,
): Promise<string[]> {
  if (!positionId) return [];
  const rows = await manager.getRepository(PositionManagedDirection).find({
    where: { positionId },
  });
  return rows.map((r) => r.directionId);
}
