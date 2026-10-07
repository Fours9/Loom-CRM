import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Not, Repository } from 'typeorm';
import { User } from '../../platform/identity/user.entity';
import { UserRole } from '../../platform/identity/user.enums';
import { AuditService } from '../../platform/audit/audit.service';
import { NotificationsService } from '../../platform/notifications/notifications.service';
import { PermissionService } from '../../platform/permissions/permission.service';
import { EmployeeAccessService } from '../../organization/access/employee-access.service';
import { DepartmentsService } from '../../organization/departments/departments.service';
import { PositionsService } from '../../organization/positions/positions.service';
import { EmployeesService } from '../../organization/employees/employees.service';
import { AbsenceRequest } from './absence-request.entity';
import { AbsenceRequestHistory } from './absence-request-history.entity';
import { AbsenceAttachment } from './absence-attachment.entity';
import { AbsenceRequestStatus, AbsenceType } from './absence.enums';
import { pwPermissions, statusGroupOf } from './pw-permissions';
import { matchesRequestTypeAndStatusGroup } from './absence-request-list-filters';
import type { Employee } from '../../organization/employees/employee.entity';
import { normalizeUploadedFileName } from '../../platform/http/normalize-uploaded-file-name';
import { absenceHistoryActionLabel } from './absence-history-labels';
import {
  TIME_EVENT_TYPE_LABELS,
  getTimeEventTypeDefinition,
  type TimeEventType,
} from './domain/time-event-type-catalog';
import { buildTimeEventTypeMetadata, mapDurationMinutes } from './domain/time-event-metadata';
import { validateTimeEventCandidate } from './domain/time-event-request-validator';
import { assertSchedulePolicy } from './domain/time-event-schedule-policy';
import { checkTimeEventOverlap } from './domain/time-event-overlap-policy';
import { TimeEventWorkflowPolicy } from './domain/time-event-workflow-policy';

export type ListQuery = {
  page?: number;
  pageSize?: number;
  scope?: 'mine' | 'managed' | 'all';
  status?: string;
  statusGroup?: string;
  statusGroups?: string[];
  type?: string;
  types?: string[];
  employeeId?: string;
  departmentId?: string;
  departmentIds?: string[];
  positionId?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
};

@Injectable()
export class AbsenceRequestsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(AbsenceRequest)
    private readonly requests: Repository<AbsenceRequest>,
    @InjectRepository(AbsenceRequestHistory)
    private readonly history: Repository<AbsenceRequestHistory>,
    @InjectRepository(AbsenceAttachment)
    private readonly attachments: Repository<AbsenceAttachment>,
    private readonly access: EmployeeAccessService,
    private readonly departments: DepartmentsService,
    private readonly positions: PositionsService,
    private readonly employees: EmployeesService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly permissions: PermissionService,
  ) {}

  async metadata(actor: User) {
    const depts = await this.departments.findAll();
    return {
      types: buildTimeEventTypeMetadata(),
      statuses: [
        { value: AbsenceRequestStatus.Pending, label: 'Подана' },
        { value: AbsenceRequestStatus.Approved, label: 'Затверджена' },
        { value: AbsenceRequestStatus.Rejected, label: 'Відхилена' },
        { value: AbsenceRequestStatus.Cancelled, label: 'Скасована' },
        {
          value: AbsenceRequestStatus.DeletionRequested,
          label: 'Запит на видалення',
        },
      ],
      departments: depts
        .filter((d) => d.isActive)
        .map((d) => ({ id: d.id, name: d.name })),
      requestScopes: [
        { value: 'all', label: 'Усі доступні' },
        { value: 'mine', label: 'Мої' },
        { value: 'managed', label: 'Команда' },
      ],
      scheduleConstraints: {
        minimumDate: null as string | null,
        maximumDate: null as string | null,
        supportsPartialDay: true,
      },
      actorRole: actor.role,
    };
  }

  async findAll(actor: User, query: ListQuery = {}) {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
    const visible = await this.access.listVisibleEmployees(actor);
    let employees = visible;
    if (query.scope === 'mine') {
      employees = visible.filter((e) => e.userId === actor.id);
    } else if (query.scope === 'managed') {
      employees = visible.filter((e) => e.userId !== actor.id);
    }
    const ids = new Set(employees.map((e) => e.id));
    const empById = new Map(employees.map((e) => [e.id, e]));
    const depts = await this.departments.findAll();
    const deptName = new Map(depts.map((d) => [d.id, d.name]));
    const positions = await this.positions.findAll();
    const posName = new Map(positions.map((p) => [p.id, p.name]));

    let rows = await this.requests.find({ order: { createdAt: 'DESC' } });
    rows = rows.filter((r) => ids.has(r.employeeId));
    if (query.employeeId) {
      rows = rows.filter((r) => r.employeeId === query.employeeId);
    }
    if (query.status) rows = rows.filter((r) => r.status === query.status);
    rows = rows.filter((r) =>
      matchesRequestTypeAndStatusGroup(
        { type: r.type, statusGroup: statusGroupOf(r) },
        {
          type: query.type,
          types: query.types,
          statusGroup: query.statusGroup,
          statusGroups: query.statusGroups,
        },
      ),
    );
    if (query.departmentIds?.length) {
      const set = new Set(query.departmentIds);
      rows = rows.filter(
        (r) => r.departmentIdAtSubmission && set.has(r.departmentIdAtSubmission),
      );
    } else if (query.departmentId) {
      rows = rows.filter(
        (r) => r.departmentIdAtSubmission === query.departmentId,
      );
    }
    if (query.positionId) {
      rows = rows.filter((r) => r.positionIdAtSubmission === query.positionId);
    }

    const sortBy = query.sortBy ?? 'createdAt';
    const dir = query.sortDir === 'asc' ? 1 : -1;
    rows.sort((a, b) => {
      const av = (a as unknown as Record<string, unknown>)[sortBy];
      const bv = (b as unknown as Record<string, unknown>)[sortBy];
      if (av === bv) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      return av > bv ? dir : -dir;
    });

    const total = rows.length;
    const slice = rows.slice((page - 1) * pageSize, page * pageSize);
    const items = await Promise.all(
      slice.map(async (r) => {
        const emp = empById.get(r.employeeId)!;
        const perms = await this.permissionsFor(actor, r, emp);
        return this.toListItem(r, emp, deptName, posName, perms);
      }),
    );
    return { items, page, pageSize, total };
  }

  async findForEmployee(actor: User, employeeId: string) {
    await this.access.requireCanView(
      actor,
      await this.access.getEmployeeOrFail(employeeId),
    );
    return this.findAll(actor, { employeeId, pageSize: 100 });
  }

  /**
   * Dedicated aggregation for People Documents tab.
   * Only requests that have ≥1 attachment; no pageSize cap from findAll.
   */
  async documentItemsForEmployee(actor: User, employeeId: string) {
    const employee = await this.access.getEmployeeOrFail(employeeId);
    await this.access.requireCanView(actor, employee);

    const requests = await this.requests.find({
      where: {
        employeeId,
        status: Not(In([AbsenceRequestStatus.Cancelled])),
      },
      order: { createdAt: 'DESC' },
    });
    if (!requests.length) {
      return [];
    }

    const requestIds = requests.map((r) => r.id);
    const attachmentRows = await this.attachments
      .createQueryBuilder('attachment')
      .where('attachment.request_id IN (:...requestIds)', { requestIds })
      .orderBy('attachment.created_at', 'ASC')
      .getMany();

    const byRequest = new Map<string, AbsenceAttachment[]>();
    for (const a of attachmentRows) {
      const list = byRequest.get(a.requestId) ?? [];
      list.push(a);
      byRequest.set(a.requestId, list);
    }

    return requests
      .filter((r) => (byRequest.get(r.id)?.length ?? 0) > 0)
      .map((r) => {
        const files = (byRequest.get(r.id) ?? []).map((a) => ({
          id: a.id,
          fileName: normalizeUploadedFileName(a.fileName),
          mimeType: a.mimeType,
          sizeBytes: a.sizeBytes,
          createdAt:
            a.createdAt instanceof Date
              ? a.createdAt.toISOString()
              : String(a.createdAt),
        }));
        const end = r.endDate ?? null;
        const typeLabel =
          TIME_EVENT_TYPE_LABELS[r.type as TimeEventType] ?? r.type;
        return {
          source: 'time_event' as const,
          id: r.id,
          employeeId: r.employeeId,
          documentType: 'time_event' as const,
          title: `${typeLabel} ${r.startDate}${end ? `–${end}` : ''}`,
          eventType: r.type,
          createdAt:
            r.createdAt instanceof Date
              ? r.createdAt.toISOString()
              : String(r.createdAt),
          relatedStartDate: r.startDate,
          relatedEndDate: end,
          files,
          permissions: { canDelete: false as const },
        };
      });
  }

  async findOne(actor: User, id: string) {
    const row = await this.getOrFail(id);
    const emp = await this.access.getEmployeeOrFail(row.employeeId);
    try {
      await this.access.requireCanView(actor, emp);
    } catch {
      throw new ForbiddenException('Cannot view this request');
    }
    const depts = await this.departments.findAll();
    const deptName = new Map(depts.map((d) => [d.id, d.name]));
    const positions = await this.positions.findAll();
    const posName = new Map(positions.map((p) => [p.id, p.name]));
    const perms = await this.permissionsFor(actor, row, emp);
    const history = await this.history.find({
      where: { requestId: id },
      order: { createdAt: 'ASC' },
    });
    const attachments = await this.attachments.find({
      where: { requestId: id },
      order: { createdAt: 'ASC' },
    });
    const list = this.toListItem(row, emp, deptName, posName, perms);
    return {
      ...list,
      employeeNameAtSubmission: row.employeeNameAtSubmission,
      employeeComment: row.employeeComment,
      decisionComment: row.decisionComment,
      adjustmentComment: row.adjustmentComment,
      deletionComment: row.deletionComment,
      createdByUserId: row.createdByUserId,
      updatedAt: row.updatedAt.toISOString(),
      decidedByUserId: row.decidedByUserId,
      statusBeforeDeletionRequest: row.statusBeforeDeletionRequest,
      permissions: perms,
      history: history.map((h) => ({
        id: h.id,
        fromStatus: null,
        toStatus: null,
        changeDescription: absenceHistoryActionLabel(h.action),
        changedByUserId: h.actorUserId ?? '',
        createdAt: h.createdAt.toISOString(),
      })),
      attachments: attachments.map((a) => ({
        id: a.id,
        originalFileName: normalizeUploadedFileName(a.fileName),
        mimeType: a.mimeType ?? 'application/octet-stream',
        sizeBytes: a.sizeBytes,
        createdAt: a.createdAt.toISOString(),
      })),
    };
  }

  async create(
    actor: User,
    input: {
      employeeId?: string;
      type: AbsenceType;
      startDate: string;
      endDate?: string | null;
      absenceStartTime?: string | null;
      absenceEndTime?: string | null;
      reason?: string | null;
      isUnpaid?: boolean;
      employeeComment?: string | null;
    },
  ) {
    const employeeId = input.employeeId ?? (await this.selfEmployeeId(actor));
    if (!employeeId) {
      throw new BadRequestException('employeeId required');
    }
    const emp = await this.access.getEmployeeOrFail(employeeId);
    await this.access.requireCanView(actor, emp);
    TimeEventWorkflowPolicy.assertCanCreateFor({
      actor,
      targetEmployeeUserId: emp.userId,
    });
    TimeEventWorkflowPolicy.assertBackdatingAllowed(
      { actor, targetEmployeeUserId: emp.userId },
      input.startDate,
    );

    const candidate = validateTimeEventCandidate({
      type: input.type,
      startDate: input.startDate,
      endDate: input.endDate,
      startTime: input.absenceStartTime,
      endTime: input.absenceEndTime,
      isUnpaid: input.isUnpaid,
    });

    const schedule = await this.employees.getScheduleDaysInternal(emp.id);
    assertSchedulePolicy(candidate.type, candidate.startDate, schedule);

    const typeLabel = TIME_EVENT_TYPE_LABELS[candidate.type];
    const category = getTimeEventTypeDefinition(candidate.type)!.category;

    const saved = await this.dataSource.transaction(async (manager) => {
      const reqRepo = manager.getRepository(AbsenceRequest);
      const histRepo = manager.getRepository(AbsenceRequestHistory);

      await this.assertNoOverlapInTx(manager, emp.id, candidate, null);

      const row = await reqRepo.save(
        reqRepo.create({
          employeeId: emp.id,
          departmentIdAtSubmission: emp.departmentId,
          positionIdAtSubmission: emp.positionId,
          employeeNameAtSubmission: `${emp.lastName} ${emp.firstName}`,
          employeeNumberAtSubmission: emp.employeeNumber,
          calendarColorAtSubmission: emp.calendarColor,
          type: candidate.type as AbsenceType,
          startDate: candidate.startDate,
          endDate: candidate.endDate,
          absenceStartTime: candidate.startTime,
          absenceEndTime: candidate.endTime,
          isUnpaid: candidate.isUnpaid,
          reason: input.reason ?? null,
          employeeComment: input.employeeComment ?? null,
          status: AbsenceRequestStatus.Pending,
          version: 1,
          createdByUserId: actor.id,
        }),
      );
      await histRepo.save(
        histRepo.create({
          requestId: row.id,
          action: 'created',
          actorUserId: actor.id,
          comment: null,
        }),
      );
      await this.audit.record(
        {
          action: 'absence.request.created',
          actorId: actor.id,
          entityType: 'absence_request',
          entityId: row.id,
          metadata: {
            type: candidate.type,
            category,
            summary: `Створено заявку «${typeLabel}»`,
          },
        },
        manager,
      );
      return row;
    });

    return this.findOne(actor, saved.id);
  }

  async updatePending(
    actor: User,
    id: string,
    input: Partial<{
      version: number;
      type: AbsenceType;
      startDate: string;
      endDate: string | null;
      absenceStartTime: string | null;
      absenceEndTime: string | null;
      isUnpaid: boolean;
      reason: string | null;
      employeeComment: string | null;
      adjustmentComment: string;
    }>,
  ) {
    const detail = await this.findOne(actor, id);
    if (!detail.permissions.canEdit && !detail.permissions.canAdjust) {
      throw new ForbiddenException('Cannot edit this request');
    }

    await this.dataSource.transaction(async (manager) => {
      const reqRepo = manager.getRepository(AbsenceRequest);
      const row = await reqRepo.findOne({ where: { id } });
      if (!row) throw new NotFoundException('Absence request not found');
      this.assertVersion(row, input.version);

      const merged = validateTimeEventCandidate({
        type: input.type ?? row.type,
        startDate: input.startDate ?? row.startDate,
        endDate:
          input.endDate !== undefined ? input.endDate : row.endDate,
        startTime:
          input.absenceStartTime !== undefined
            ? input.absenceStartTime
            : row.absenceStartTime,
        endTime:
          input.absenceEndTime !== undefined
            ? input.absenceEndTime
            : row.absenceEndTime,
        isUnpaid:
          input.isUnpaid !== undefined ? input.isUnpaid : row.isUnpaid,
      });

      const schedule = await this.employees.getScheduleDaysInternal(
        row.employeeId,
      );
      assertSchedulePolicy(merged.type, merged.startDate, schedule);
      await this.assertNoOverlapInTx(manager, row.employeeId, merged, row.id);

      row.type = merged.type as AbsenceType;
      row.startDate = merged.startDate;
      row.endDate = merged.endDate;
      row.absenceStartTime = merged.startTime;
      row.absenceEndTime = merged.endTime;
      row.isUnpaid = merged.isUnpaid;
      if (input.reason !== undefined) row.reason = input.reason;
      if (input.employeeComment !== undefined)
        row.employeeComment = input.employeeComment;
      if (input.adjustmentComment !== undefined)
        row.adjustmentComment = input.adjustmentComment;
      row.version += 1;
      await reqRepo.save(row);
      await manager.getRepository(AbsenceRequestHistory).save(
        manager.getRepository(AbsenceRequestHistory).create({
          requestId: id,
          action: 'updated',
          actorUserId: actor.id,
          comment: null,
        }),
      );
      const category = getTimeEventTypeDefinition(merged.type)!.category;
      await this.audit.record(
        {
          action: 'absence.request.updated',
          actorId: actor.id,
          entityType: 'absence_request',
          entityId: id,
          metadata: { type: merged.type, category },
        },
        manager,
      );
    });

    return this.findOne(actor, id);
  }

  async approve(actor: User, id: string, body: { version?: number; decisionComment?: string }) {
    return this.decide(actor, id, AbsenceRequestStatus.Approved, body);
  }

  async reject(actor: User, id: string, body: { version?: number; decisionComment?: string }) {
    return this.decide(actor, id, AbsenceRequestStatus.Rejected, body);
  }

  /**
   * Pending-only hard delete (PW `deletePending`).
   * Approved/rejected absences must go through request-deletion → admin approve.
   * Status `cancelled` is legacy only; new withdrawals from pending do not create it.
   */
  async deletePending(actor: User, id: string, version?: number) {
    const detail = await this.findOne(actor, id);
    if (!detail.permissions.canDelete) {
      throw new ForbiddenException('Cannot delete this request');
    }
    const row = await this.getOrFail(id);
    this.assertVersion(row, version);
    if (row.status !== AbsenceRequestStatus.Pending) {
      throw new BadRequestException(
        'Видалити можна лише заявку в статусі «подана». Інакше подайте запит на видалення.',
      );
    }
    await this.physicalDelete(actor, id, 'delete_pending');
    return { ok: true };
  }

  /** @deprecated Prefer deletePending — kept for POST /cancel alias. */
  async cancel(actor: User, id: string, version?: number) {
    return this.deletePending(actor, id, version);
  }

  async adjust(
    actor: User,
    id: string,
    input: {
      version?: number;
      adjustmentComment?: string;
      type?: AbsenceType;
      startDate?: string;
      endDate?: string | null;
      absenceStartTime?: string | null;
      absenceEndTime?: string | null;
      isUnpaid?: boolean;
      reason?: string | null;
      employeeComment?: string | null;
    },
  ) {
    const detail = await this.findOne(actor, id);
    if (!detail.permissions.canAdjust) {
      throw new ForbiddenException('Cannot adjust this request');
    }

    await this.dataSource.transaction(async (manager) => {
      const reqRepo = manager.getRepository(AbsenceRequest);
      const row = await reqRepo.findOne({ where: { id } });
      if (!row) throw new NotFoundException('Absence request not found');
      this.assertVersion(row, input.version);

      const merged = validateTimeEventCandidate({
        type: input.type ?? row.type,
        startDate: input.startDate ?? row.startDate,
        endDate:
          input.endDate !== undefined ? input.endDate : row.endDate,
        startTime:
          input.absenceStartTime !== undefined
            ? input.absenceStartTime
            : row.absenceStartTime,
        endTime:
          input.absenceEndTime !== undefined
            ? input.absenceEndTime
            : row.absenceEndTime,
        isUnpaid:
          input.isUnpaid !== undefined ? input.isUnpaid : row.isUnpaid,
      });

      const schedule = await this.employees.getScheduleDaysInternal(
        row.employeeId,
      );
      assertSchedulePolicy(merged.type, merged.startDate, schedule);
      await this.assertNoOverlapInTx(manager, row.employeeId, merged, row.id);

      row.type = merged.type as AbsenceType;
      row.startDate = merged.startDate;
      row.endDate = merged.endDate;
      row.absenceStartTime = merged.startTime;
      row.absenceEndTime = merged.endTime;
      row.isUnpaid = merged.isUnpaid;
      if (input.reason !== undefined) row.reason = input.reason ?? null;
      if (input.employeeComment !== undefined)
        row.employeeComment = input.employeeComment ?? null;
      row.adjustmentComment = input.adjustmentComment ?? row.adjustmentComment;
      row.version += 1;
      await reqRepo.save(row);
      await manager.getRepository(AbsenceRequestHistory).save(
        manager.getRepository(AbsenceRequestHistory).create({
          requestId: id,
          action: 'adjusted',
          actorUserId: actor.id,
          comment: input.adjustmentComment ?? null,
        }),
      );
      const category = getTimeEventTypeDefinition(merged.type)!.category;
      await this.audit.record(
        {
          action: 'absence.request.adjusted',
          actorId: actor.id,
          entityType: 'absence_request',
          entityId: id,
          metadata: { type: merged.type, category },
        },
        manager,
      );
    });

    return this.findOne(actor, id);
  }

  async requestDeletion(
    actor: User,
    id: string,
    body: { version?: number; deletionComment?: string },
  ) {
    const detail = await this.findOne(actor, id);
    if (!detail.permissions.canRequestDeletion) {
      throw new ForbiddenException('Cannot request deletion');
    }
    const row = await this.getOrFail(id);
    this.assertVersion(row, body.version);
    row.statusBeforeDeletionRequest = row.status;
    row.status = AbsenceRequestStatus.DeletionRequested;
    row.deletionRequestedAt = new Date();
    row.deletionRequestedByUserId = actor.id;
    row.deletionComment = body.deletionComment ?? null;
    row.version += 1;
    await this.requests.save(row);
    await this.history.save(
      this.history.create({
        requestId: id,
        action: 'deletion_requested',
        actorUserId: actor.id,
        comment: body.deletionComment ?? null,
      }),
    );
    return this.findOne(actor, id);
  }

  async approveDeletion(actor: User, id: string, body: { version?: number }) {
    if (actor.role !== UserRole.Admin) {
      throw new ForbiddenException('Only admin can approve deletion');
    }
    const row = await this.getOrFail(id);
    this.assertVersion(row, body.version);
    if (row.status !== AbsenceRequestStatus.DeletionRequested) {
      throw new BadRequestException('Deletion not requested');
    }
    await this.physicalDelete(actor, id, 'admin_approve_deletion');
    return { ok: true };
  }

  async rejectDeletion(
    actor: User,
    id: string,
    body: { version?: number; comment?: string },
  ) {
    if (actor.role !== UserRole.Admin) {
      throw new ForbiddenException('Only admin can reject deletion');
    }
    const row = await this.getOrFail(id);
    this.assertVersion(row, body.version);
    row.status =
      row.statusBeforeDeletionRequest ?? AbsenceRequestStatus.Approved;
    row.deletionRequestedAt = null;
    row.deletionRequestedByUserId = null;
    row.deletionComment = body.comment ?? null;
    row.version += 1;
    await this.requests.save(row);
    await this.history.save(
      this.history.create({
        requestId: id,
        action: 'deletion_rejected',
        actorUserId: actor.id,
        comment: body.comment ?? null,
      }),
    );
    return this.findOne(actor, id);
  }

  async listAttachments(actor: User, id: string) {
    const detail = await this.findOne(actor, id);
    return detail.attachments;
  }

  async addAttachmentFile(
    actor: User,
    id: string,
    file: { originalname: string; mimetype: string; buffer: Buffer; size: number },
  ) {
    const detail = await this.findOne(actor, id);
    if (!detail.permissions.canManageAttachments) {
      throw new ForbiddenException('Cannot manage attachments');
    }
    const saved = await this.attachments.save(
      this.attachments.create({
        requestId: id,
        fileName: normalizeUploadedFileName(file.originalname),
        storageKey: `db:${id}:${Date.now()}`,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        contentBase64: file.buffer.toString('base64'),
      }),
    );
    return {
      id: saved.id,
      originalFileName: saved.fileName,
      mimeType: saved.mimeType ?? 'application/octet-stream',
      sizeBytes: saved.sizeBytes,
      createdAt: saved.createdAt.toISOString(),
    };
  }

  async removeAttachment(actor: User, id: string, attachmentId: string) {
    const detail = await this.findOne(actor, id);
    if (!detail.permissions.canManageAttachments) {
      throw new ForbiddenException('Cannot manage attachments');
    }
    await this.attachments.delete({ id: attachmentId, requestId: id });
    return { ok: true };
  }

  async downloadAttachment(actor: User, id: string, attachmentId: string) {
    await this.findOne(actor, id);
    const row = await this.attachments.findOne({
      where: { id: attachmentId, requestId: id },
    });
    if (!row || !row.contentBase64) {
      throw new NotFoundException('Attachment not found');
    }
    return {
      buffer: Buffer.from(row.contentBase64, 'base64'),
      mimeType: row.mimeType ?? 'application/octet-stream',
      fileName: normalizeUploadedFileName(row.fileName),
    };
  }

  private async decide(
    actor: User,
    id: string,
    status: AbsenceRequestStatus.Approved | AbsenceRequestStatus.Rejected,
    body: { version?: number; decisionComment?: string },
  ) {
    const detail = await this.findOne(actor, id);
    const allowed =
      status === AbsenceRequestStatus.Approved
        ? detail.permissions.canApprove
        : detail.permissions.canReject;
    if (!allowed) {
      throw new ForbiddenException('Cannot decide on this request');
    }
    const row = await this.getOrFail(id);
    this.assertVersion(row, body.version);
    const emp = await this.access.getEmployeeOrFail(row.employeeId);
    row.status = status;
    row.decisionComment = body.decisionComment ?? null;
    row.decidedAt = new Date();
    row.decidedByUserId = actor.id;
    row.version += 1;

    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(AbsenceRequest).save(row);
      await manager.getRepository(AbsenceRequestHistory).save(
        manager.getRepository(AbsenceRequestHistory).create({
          requestId: row.id,
          action:
            status === AbsenceRequestStatus.Approved ? 'approved' : 'rejected',
          actorUserId: actor.id,
          comment: body.decisionComment ?? null,
        }),
      );
      await this.audit.record(
        {
          action:
            status === AbsenceRequestStatus.Approved
              ? 'absence.request.approved'
              : 'absence.request.rejected',
          actorId: actor.id,
          entityType: 'absence_request',
          entityId: row.id,
          metadata: {
            type: row.type,
            category: getTimeEventTypeDefinition(row.type)?.category ?? null,
          },
        },
        manager,
      );
      if (emp.userId) {
        const typeLabel =
          TIME_EVENT_TYPE_LABELS[row.type as TimeEventType] ?? row.type;
        await this.notifications.create(
          {
            recipientId: emp.userId,
            type:
              status === AbsenceRequestStatus.Approved
                ? 'request.approved'
                : 'request.rejected',
            title:
              status === AbsenceRequestStatus.Approved
                ? 'Заявку схвалено'
                : 'Заявку відхилено',
            body:
              status === AbsenceRequestStatus.Approved
                ? `Заявку «${typeLabel}» (${row.startDate}) схвалено`
                : `Заявку «${typeLabel}» (${row.startDate}) відхилено`,
            payload: { requestId: row.id },
          },
          manager,
        );
      }
    });

    return this.findOne(actor, id);
  }

  private async assertNoOverlapInTx(
    manager: EntityManager,
    employeeId: string,
    candidate: {
      type: TimeEventType;
      startDate: string;
      endDate: string | null;
      startTime: string | null;
      endTime: string | null;
    },
    excludeRequestId: string | null,
  ): Promise<void> {
    const existing = await manager.getRepository(AbsenceRequest).find({
      where: { employeeId },
    });
    const overlap = checkTimeEventOverlap({
      candidate,
      excludeRequestId,
      existing: existing.map((r) => ({
        id: r.id,
        type: r.type,
        status: r.status,
        statusBeforeDeletionRequest: r.statusBeforeDeletionRequest,
        startDate: r.startDate,
        endDate: r.endDate,
        startTime: r.absenceStartTime,
        endTime: r.absenceEndTime,
      })),
    });
    if (overlap) {
      throw new BadRequestException(overlap);
    }
  }

  /** Single physical removal path for pending delete and admin-approved deletion. */
  private async physicalDelete(
    actor: User,
    id: string,
    reason: 'delete_pending' | 'admin_approve_deletion',
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(AbsenceAttachment).delete({ requestId: id });
      await manager.getRepository(AbsenceRequestHistory).delete({ requestId: id });
      await manager.getRepository(AbsenceRequest).delete({ id });
      await this.audit.record(
        {
          action: 'absence.request.deleted',
          actorId: actor.id,
          entityType: 'absence_request',
          entityId: id,
          metadata: { reason },
        },
        manager,
      );
    });
  }

  private assertVersion(row: AbsenceRequest, version?: number) {
    if (version != null && version !== row.version) {
      throw new BadRequestException('Version conflict');
    }
  }

  private async permissionsFor(
    actor: User,
    request: AbsenceRequest,
    employee: Employee,
  ) {
    return pwPermissions(actor, request, employee, this.permissions, {
      canManageSubmissionDepartment: await this.canManageSubmissionDepartment(
        actor,
        request,
        employee,
      ),
    });
  }

  /** PW `canModerateRequest` department leg (admin always true). */
  private async canManageSubmissionDepartment(
    actor: User,
    request: AbsenceRequest,
    employee: Employee,
  ): Promise<boolean> {
    if (this.access.isAdmin(actor)) return true;
    const deptId =
      request.departmentIdAtSubmission ?? employee.departmentId ?? null;
    if (!deptId) return false;
    const managed = await this.access.managedDepartmentIds(actor);
    return managed.includes(deptId);
  }

  private async selfEmployeeId(actor: User): Promise<string | null> {
    const visible = await this.access.listVisibleEmployees(actor);
    return visible.find((e) => e.userId === actor.id)?.id ?? null;
  }

  private async getOrFail(id: string): Promise<AbsenceRequest> {
    const row = await this.requests.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Absence request not found');
    return row;
  }

  private toListItem(
    r: AbsenceRequest,
    emp: { id: string; employeeNumber: string; calendarColor: string | null },
    deptName: Map<string, string>,
    posName: Map<string, string>,
    perms: ReturnType<typeof pwPermissions>,
  ) {
    return {
      id: r.id,
      employeeId: r.employeeId,
      employeeName: r.employeeNameAtSubmission,
      employeeNumber:
        r.employeeNumberAtSubmission ?? emp.employeeNumber ?? null,
      calendarColor: r.calendarColorAtSubmission ?? emp.calendarColor ?? null,
      type: r.type,
      status: r.status,
      statusGroup: statusGroupOf(r),
      startDate: r.startDate,
      endDate: r.endDate,
      absenceStartTime: r.absenceStartTime,
      absenceEndTime: r.absenceEndTime,
      durationMinutes: mapDurationMinutes(
        r.type,
        r.absenceStartTime,
        r.absenceEndTime,
      ),
      isUnpaid: r.isUnpaid,
      reason: r.reason,
      version: r.version,
      createdAt: r.createdAt.toISOString(),
      decidedAt: r.decidedAt?.toISOString() ?? null,
      deletionRequestedAt: r.deletionRequestedAt?.toISOString() ?? null,
      departmentIdAtSubmission: r.departmentIdAtSubmission ?? '',
      departmentName: r.departmentIdAtSubmission
        ? deptName.get(r.departmentIdAtSubmission) ?? null
        : null,
      positionIdAtSubmission: r.positionIdAtSubmission,
      positionName: r.positionIdAtSubmission
        ? posName.get(r.positionIdAtSubmission) ?? null
        : null,
      canDelete: perms.canDelete,
      canEdit: perms.canEdit,
    };
  }
}
