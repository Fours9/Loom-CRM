import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import type { PositionCatalogContextV1 } from '@loom/contracts-questionnaires';
import { PositionCatalogReadService } from './position-catalog-read.service';

/**
 * Public Organization → Questionnaires boundary for Position Catalog snapshots.
 * Delegates to manager-aware {@link PositionCatalogReadService} so capture stays
 * in the same transaction as create/attach.
 */
@Injectable()
export class PositionCatalogFacade {
  constructor(private readonly reads: PositionCatalogReadService) {}

  buildSnapshotForEmployee(
    employeeId: string,
    manager?: EntityManager,
  ): Promise<PositionCatalogContextV1> {
    return this.reads.buildSnapshotForEmployee(employeeId, manager);
  }
}
