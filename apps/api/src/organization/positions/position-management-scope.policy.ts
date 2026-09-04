import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { User } from '../../platform/identity/user.entity';
import { AuthorizationContextService } from '../../platform/access-control/authorization-context.service';
import { Employee } from '../employees/employee.entity';
import { Department } from '../departments/department.entity';
import { CurrentEmploymentAssignmentResolver } from '../employment-catalog/current-employment-assignment.resolver';
import { Position } from './position.entity';

export type PositionManagementScope = {
  isAdminEquivalent: boolean;
  /** null = empty manage list / forbid create for non-admin */
  directionId: string | null;
};

/**
 * Scopes PositionsManage mutations + GET /positions/manage (ADR 0011 §E).
 * Catalog GET /positions stays unscoped.
 */
export class PositionManagementScopePolicy {
  constructor(
    private readonly authorization: AuthorizationContextService,
    private readonly currentAssignment: CurrentEmploymentAssignmentResolver,
  ) {}

  async resolve(
    actor: User,
    manager?: EntityManager,
  ): Promise<PositionManagementScope> {
    const authz = await this.authorization.resolve(actor.id, manager);
    if (authz.isAdminEquivalent) {
      return { isAdminEquivalent: true, directionId: null };
    }

    const em = manager;
    // Without manager, callers use default repos via services — resolve direction from EA.
    // This method is called from PositionsService which has DataSource.
    return {
      isAdminEquivalent: false,
      directionId: null, // filled by resolveWithRepos below
    };
  }

  async resolveForActor(
    actor: User,
    employeeRepo: { findOne: Function },
    currentAssignment: CurrentEmploymentAssignmentResolver,
    departmentRepo: { findOne: Function },
  ): Promise<PositionManagementScope> {
    const authz = await this.authorization.resolve(actor.id);
    if (authz.isAdminEquivalent) {
      return { isAdminEquivalent: true, directionId: null };
    }

    const self = await employeeRepo.findOne({
      where: { userId: actor.id },
    });
    if (!self) {
      return { isAdminEquivalent: false, directionId: null };
    }

    const ea = await currentAssignment.resolve(self as Employee);
    let directionId = ea?.directionId ?? null;
    if (!directionId && ea?.departmentId) {
      const dept = await departmentRepo.findOne({
        where: { id: ea.departmentId },
      });
      directionId = (dept as Department | null)?.directionId ?? null;
    }
    return { isAdminEquivalent: false, directionId };
  }

  assertCanMutate(
    scope: PositionManagementScope,
    position: Pick<Position, 'departmentId' | 'directionId'>,
  ): void {
    if (scope.isAdminEquivalent) return;
    if (!scope.directionId) {
      throw new ForbiddenException('No direction scope for positions manage');
    }
    if (position.departmentId == null && position.directionId == null) {
      throw new ForbiddenException(
        'Global positions require admin-equivalent access',
      );
    }
    const posDirection = position.directionId;
    if (posDirection && posDirection !== scope.directionId) {
      throw new ForbiddenException('Position outside actor direction scope');
    }
  }

  assertCanCreate(
    scope: PositionManagementScope,
    input: { departmentId: string | null; directionId: string | null },
  ): void {
    if (scope.isAdminEquivalent) return;
    if (!scope.directionId) {
      throw new BadRequestException(
        'Cannot create positions without an active direction assignment',
      );
    }
    if (input.departmentId == null && input.directionId == null) {
      throw new ForbiddenException(
        'Global positions require admin-equivalent access',
      );
    }
    if (input.directionId && input.directionId !== scope.directionId) {
      throw new ForbiddenException('Direction outside actor scope');
    }
  }
}
