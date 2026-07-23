import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { User } from '../../platform/identity/user.entity';
import { UserRole } from '../../platform/identity/user.enums';
import { AuditService } from '../../platform/audit/audit.service';
import { NotificationsService } from '../../platform/notifications/notifications.service';
import { PermissionService } from '../../platform/permissions/permission.service';
import { EmployeeAccessService } from '../../organization/access/employee-access.service';
import { DepartmentsService } from '../../organization/departments/departments.service';
import { PositionsService } from '../../organization/positions/positions.service';
import { AbsenceRequest } from './absence-request.entity';
import { AbsenceRequestHistory } from './absence-request-history.entity';
import { AbsenceAttachment } from './absence-attachment.entity';
import { AbsenceRequestStatus, AbsenceType } from './absence.enums';
import { pwPermissions, statusGroupOf } from './pw-permissions';

export type ListQuery = {
  page?: number;
  pageSize?: number;
  scope?: 'mine' | 'managed' | 'all';
  status?: string;
  statusGroup?: string;
  type?: string;
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
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly permissions: PermissionService,
  ) {}

  async metadata(actor: User) {
    const depts = await this.departments.findAll();
    return {
      types: [
        { value: AbsenceType.Vacation, label: 'Відпустка' },
        { value: AbsenceType.DayOff, label: 'Відгул' },
        { value: AbsenceType.SickLeave, label: 'Лікарняний' },
        { value: AbsenceType.PartTime, label: 'Неповний день' },
      ],
      statuses: [
        { value: AbsenceRequestStatus.Pending, label: 'Очікує' },
        { value: AbsenceRequestStatus.Approved, label: 'Схвалено' },
        { value: AbsenceRequestStatus.Rejected, label: 'Відхилено' },
        { value: AbsenceRequestStatus.Cancelled, label: 'Скасовано' },
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
    if (query.type) rows = rows.filter((r) => r.type === query.type);
    if (query.status) rows = rows.filter((r) => r.status === query.status);
    if (query.statusGroup) {
      rows = rows.filter((r) => statusGroupOf(r) === query.statusGroup);
    }
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
    const items = slice.map((r) => {
      const emp = empById.get(r.employeeId)!;
      const perms = pwPermissions(actor, r, emp, this.permissions);
      return this.toListItem(r, emp, deptName, posName, perms);
    });
    return { items, page, pageSize, total };
  }

  async findForEmployee(actor: User, employeeId: string) {
    await this.access.requireCanView(
      actor,
      await this.access.getEmployeeOrFail(employeeId),
    );
    return this.findAll(actor, { employeeId, pageSize: 100 });
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
    const perms = pwPermissions(actor, row, emp, this.permissions);
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
        changeDescription: h.action,
        changedByUserId: h.actorUserId ?? '',
        createdAt: h.createdAt.toISOString(),
      })),
      attachments: attachments.map((a) => ({
        id: a.id,
        originalFileName: a.fileName,
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
    if (actor.role === UserRole.Employee && emp.userId !== actor.id) {
      throw new ForbiddenException('Cannot create absence for another employee');
    }

    const saved = await this.dataSource.transaction(async (manager) => {
      const reqRepo = manager.getRepository(AbsenceRequest);
      const histRepo = manager.getRepository(AbsenceRequestHistory);
      const row = await reqRepo.save(
        reqRepo.create({
          employeeId: emp.id,
          departmentIdAtSubmission: emp.departmentId,
          positionIdAtSubmission: emp.positionId,
          employeeNameAtSubmission: `${emp.lastName} ${emp.firstName}`,
          employeeNumberAtSubmission: emp.employeeNumber,
          calendarColorAtSubmission: emp.calendarColor,
          type: input.type,
          startDate: input.startDate,
          endDate: input.endDate ?? null,
          absenceStartTime: input.absenceStartTime ?? null,
          absenceEndTime: input.absenceEndTime ?? null,
          isUnpaid: !!input.isUnpaid,
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
    const row = await this.getOrFail(id);
    this.assertVersion(row, input.version);
    if (input.type !== undefined) row.type = input.type;
    if (input.startDate !== undefined) row.startDate = input.startDate;
    if (input.endDate !== undefined) row.endDate = input.endDate;
    if (input.absenceStartTime !== undefined)
      row.absenceStartTime = input.absenceStartTime;
    if (input.absenceEndTime !== undefined)
      row.absenceEndTime = input.absenceEndTime;
    if (input.isUnpaid !== undefined) row.isUnpaid = input.isUnpaid;
    if (input.reason !== undefined) row.reason = input.reason;
    if (input.employeeComment !== undefined)
      row.employeeComment = input.employeeComment;
    if (input.adjustmentComment !== undefined)
      row.adjustmentComment = input.adjustmentComment;
    row.version += 1;
    await this.requests.save(row);
    await this.history.save(
      this.history.create({
        requestId: id,
        action: 'updated',
        actorUserId: actor.id,
        comment: null,
      }),
    );
    return this.findOne(actor, id);
  }

  async approve(actor: User, id: string, body: { version?: number; decisionComment?: string }) {
    return this.decide(actor, id, AbsenceRequestStatus.Approved, body);
  }

  async reject(actor: User, id: string, body: { version?: number; decisionComment?: string }) {
    return this.decide(actor, id, AbsenceRequestStatus.Rejected, body);
  }

  async cancel(actor: User, id: string, version?: number) {
    const detail = await this.findOne(actor, id);
    if (!detail.permissions.canDelete) {
      throw new ForbiddenException('Cannot cancel this request');
    }
    const row = await this.getOrFail(id);
    this.assertVersion(row, version);
    row.status = AbsenceRequestStatus.Cancelled;
    row.version += 1;
    await this.requests.save(row);
    await this.history.save(
      this.history.create({
        requestId: id,
        action: 'cancelled',
        actorUserId: actor.id,
        comment: null,
      }),
    );
    return { ok: true };
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
    const row = await this.getOrFail(id);
    this.assertVersion(row, input.version);
    if (input.startDate !== undefined) row.startDate = input.startDate;
    if (input.endDate !== undefined) row.endDate = input.endDate ?? null;
    if (input.type !== undefined) row.type = input.type;
    if (input.absenceStartTime !== undefined)
      row.absenceStartTime = input.absenceStartTime ?? null;
    if (input.absenceEndTime !== undefined)
      row.absenceEndTime = input.absenceEndTime ?? null;
    if (input.isUnpaid !== undefined) row.isUnpaid = input.isUnpaid;
    if (input.reason !== undefined) row.reason = input.reason ?? null;
    if (input.employeeComment !== undefined)
      row.employeeComment = input.employeeComment ?? null;
    row.adjustmentComment = input.adjustmentComment ?? row.adjustmentComment;
    row.version += 1;
    await this.requests.save(row);
    await this.history.save(
      this.history.create({
        requestId: id,
        action: 'adjusted',
        actorUserId: actor.id,
        comment: input.adjustmentComment ?? null,
      }),
    );
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
    await this.attachments.delete({ requestId: id });
    await this.history.delete({ requestId: id });
    await this.requests.delete({ id });
    await this.audit.record({
      action: 'absence.request.deleted',
      actorId: actor.id,
      entityType: 'absence_request',
      entityId: id,
    });
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
        fileName: file.originalname,
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
      fileName: row.fileName,
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
        },
        manager,
      );
      if (emp.userId) {
        await this.notifications.create(
          {
            recipientId: emp.userId,
            type:
              status === AbsenceRequestStatus.Approved
                ? 'absence.request.approved'
                : 'absence.request.rejected',
            title:
              status === AbsenceRequestStatus.Approved
                ? 'Заявку схвалено'
                : 'Заявку відхилено',
            body: `Заявка ${row.startDate}`,
            payload: { requestId: row.id },
          },
          manager,
        );
      }
    });

    return this.findOne(actor, id);
  }

  private assertVersion(row: AbsenceRequest, version?: number) {
    if (version != null && version !== row.version) {
      throw new BadRequestException('Version conflict');
    }
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
