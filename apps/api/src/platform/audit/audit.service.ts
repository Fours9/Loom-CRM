import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { AuditLog } from './audit-log.entity';

export type AuditRecordInput = {
  action: string;
  actorId?: string | null;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
};

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly logs: Repository<AuditLog>,
  ) {}

  async record(
    input: AuditRecordInput,
    manager?: EntityManager,
  ): Promise<AuditLog> {
    const repo = manager ? manager.getRepository(AuditLog) : this.logs;
    const row = repo.create({
      actorUserId: input.actorId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      metadata: input.metadata ?? null,
    });
    return repo.save(row);
  }
}
