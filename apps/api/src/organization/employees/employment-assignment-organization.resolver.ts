import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { Company } from '../companies/company.entity';
import { Direction } from '../companies/direction.entity';
import { Department } from '../departments/department.entity';
import { Position } from '../positions/position.entity';
import { didAssignmentHierarchyDrift } from './assignment-hierarchy-drift.policy';
import {
  getPositionBlockedReason,
  isCompanySelectable,
  isDepartmentSelectable,
  isDirectionSelectable,
  isPositionSelectable,
} from './organization-selectability.policy';

export type AssignmentOrgState = {
  companyId: string | null;
  directionId: string | null;
  departmentId: string | null;
  positionId: string | null;
};

export type ResolveAssignmentOrgInput = {
  mode: 'create' | 'update';
  effective: Omit<AssignmentOrgState, 'companyId'>;
  existing: AssignmentOrgState | null;
};

export class AssignmentHierarchyChangedDuringResolutionError extends Error {
  constructor() {
    super('Assignment hierarchy changed during resolution');
  }
}

export function shouldRetryHierarchyDrift(
  error: unknown,
  attempt: number,
  maxAttempts: number,
): boolean {
  return (
    error instanceof AssignmentHierarchyChangedDuringResolutionError &&
    attempt < maxAttempts - 1
  );
}

export function rethrowAssignmentWriteError(error: unknown): never {
  if (error instanceof AssignmentHierarchyChangedDuringResolutionError) {
    throw new ConflictException(
      'Organization hierarchy changed during save; retry the request',
    );
  }
  throw error;
}

/**
 * Canonical org hierarchy resolution for EA create/update and employee create.
 * Locks Company → Direction → Department → Position (pessimistic_write) and
 * fail-closes on hierarchy mismatch / inactive entities.
 */
@Injectable()
export class EmploymentAssignmentOrganizationResolver {
  async resolve(
    manager: EntityManager,
    input: ResolveAssignmentOrgInput,
  ): Promise<AssignmentOrgState> {
    const companyRepo = manager.getRepository(Company);
    const directionRepo = manager.getRepository(Direction);
    const departmentRepo = manager.getRepository(Department);
    const positionRepo = manager.getRepository(Position);

    const prePosition = input.effective.positionId
      ? await positionRepo.findOne({
          where: { id: input.effective.positionId },
          relations: ['department', 'direction'],
        })
      : null;
    if (input.effective.positionId && !prePosition) {
      throw new NotFoundException('Position not found');
    }

    const candidateDepartmentId =
      prePosition?.departmentId ?? input.effective.departmentId ?? null;
    const preDepartment =
      candidateDepartmentId != null
        ? await departmentRepo.findOne({
            where: { id: candidateDepartmentId },
            relations: ['direction'],
          })
        : null;
    if (candidateDepartmentId && !preDepartment) {
      throw new NotFoundException('Department not found');
    }

    const candidateDirectionId =
      preDepartment?.directionId ??
      prePosition?.directionId ??
      input.effective.directionId ??
      null;
    const preDirection =
      candidateDirectionId != null
        ? await directionRepo.findOne({
            where: { id: candidateDirectionId },
          })
        : null;
    if (candidateDirectionId && !preDirection) {
      throw new NotFoundException('Direction not found');
    }

    const candidateCompanyId = preDirection?.companyId ?? null;
    const lockedCompany =
      candidateCompanyId != null
        ? await companyRepo.findOne({
            where: { id: candidateCompanyId },
            lock: { mode: 'pessimistic_write' },
          })
        : null;
    if (candidateCompanyId && !lockedCompany) {
      throw new NotFoundException('Company not found');
    }
    const lockedDirection =
      candidateDirectionId != null
        ? await directionRepo.findOne({
            where: { id: candidateDirectionId },
            lock: { mode: 'pessimistic_write' },
          })
        : null;
    if (candidateDirectionId && !lockedDirection) {
      throw new NotFoundException('Direction not found');
    }
    const lockedDepartment =
      candidateDepartmentId != null
        ? await departmentRepo.findOne({
            where: { id: candidateDepartmentId },
            lock: { mode: 'pessimistic_write' },
          })
        : null;
    if (candidateDepartmentId && !lockedDepartment) {
      throw new NotFoundException('Department not found');
    }
    const lockedPosition =
      input.effective.positionId != null
        ? await positionRepo.findOne({
            where: { id: input.effective.positionId },
            lock: { mode: 'pessimistic_write' },
          })
        : null;
    if (input.effective.positionId && !lockedPosition) {
      throw new NotFoundException('Position not found');
    }

    if (
      didAssignmentHierarchyDrift({
        candidateCompanyId,
        candidateDirectionId,
        candidateDepartmentId,
        candidatePositionId: input.effective.positionId ?? null,
        lockedDirectionCompanyId: lockedDirection?.companyId,
        lockedDepartmentDirectionId: lockedDepartment?.directionId,
        lockedPositionDepartmentId: lockedPosition?.departmentId,
        discoveryPositionDepartmentId: prePosition?.departmentId,
        lockedPositionDirectionId: lockedPosition?.directionId,
        discoveryPositionDirectionId: prePosition?.directionId,
      })
    ) {
      throw new AssignmentHierarchyChangedDuringResolutionError();
    }

    let departmentId = input.effective.departmentId ?? null;
    let directionId = input.effective.directionId ?? null;

    if (lockedPosition?.departmentId != null) {
      if (departmentId != null && departmentId !== lockedPosition.departmentId) {
        throw new BadRequestException(
          'Assignment departmentId must match position.departmentId',
        );
      }
      departmentId = lockedPosition.departmentId;
    }
    if (lockedPosition?.directionId != null) {
      if (directionId != null && directionId !== lockedPosition.directionId) {
        throw new BadRequestException(
          'Assignment directionId must match position.directionId',
        );
      }
      directionId = lockedPosition.directionId;
    }
    if (lockedDepartment?.directionId != null) {
      if (directionId != null && directionId !== lockedDepartment.directionId) {
        throw new BadRequestException(
          'Assignment directionId must match department.directionId',
        );
      }
      directionId = lockedDepartment.directionId;
    }

    const companyId = directionId ? (lockedDirection?.companyId ?? null) : null;
    const currentCompany = companyId ? lockedCompany : null;
    const currentDirection = directionId ? lockedDirection : null;
    const currentDepartment = departmentId ? lockedDepartment : null;
    const currentPosition = input.effective.positionId ? lockedPosition : null;

    const requireCompanySelectable =
      companyId != null &&
      (input.mode === 'create' ||
        !this.isSameHistoricalId(companyId, input.existing?.companyId));
    if (requireCompanySelectable && !isCompanySelectable(currentCompany)) {
      throw new BadRequestException('Company is inactive');
    }

    const requireDirectionSelectable =
      directionId != null &&
      (input.mode === 'create' ||
        !this.isSameHistoricalId(directionId, input.existing?.directionId));
    if (
      requireDirectionSelectable &&
      !isDirectionSelectable({
        direction: currentDirection,
        company: currentCompany,
      })
    ) {
      throw new BadRequestException('Direction is inactive');
    }

    const requireDepartmentSelectable =
      departmentId != null &&
      (input.mode === 'create' ||
        !this.isSameHistoricalId(departmentId, input.existing?.departmentId));
    if (
      requireDepartmentSelectable &&
      !isDepartmentSelectable({
        department: currentDepartment,
        direction: currentDirection,
        company: currentCompany,
      })
    ) {
      throw new BadRequestException('Department is inactive');
    }

    const requirePositionSelectable =
      input.effective.positionId != null &&
      (input.mode === 'create' ||
        !this.isSameHistoricalId(
          input.effective.positionId,
          input.existing?.positionId,
        ));
    if (
      requirePositionSelectable &&
      !isPositionSelectable({
        position: currentPosition,
        department: currentDepartment,
        direction: currentDirection,
        company: currentCompany,
      })
    ) {
      throw new BadRequestException(
        getPositionBlockedReason({
          position: currentPosition,
          department: currentDepartment,
          direction: currentDirection,
          company: currentCompany,
        }) === 'hierarchy_changed'
          ? 'Position hierarchy is inconsistent'
          : 'Position is inactive',
      );
    }

    return {
      companyId,
      directionId,
      departmentId,
      positionId: input.effective.positionId ?? null,
    };
  }

  private isSameHistoricalId(
    id: string | null,
    existingId: string | null | undefined,
  ): boolean {
    return id != null && id === (existingId ?? null);
  }
}
