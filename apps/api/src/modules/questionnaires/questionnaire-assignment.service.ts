import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Not, Repository } from 'typeorm';
import { User } from '../../platform/identity/user.entity';
import { UserStatus } from '../../platform/identity/user.enums';
import { UsersService } from '../../platform/identity/users.service';
import { Permission } from '../../platform/permissions/permission.names';
import { PermissionService } from '../../platform/permissions/permission.service';
import { EmployeeAccessService } from '../../organization/access/employee-access.service';
import { AuditService } from '../../platform/audit/audit.service';
import { QuestionnaireAssignment } from './questionnaire-assignment.entity';
import { QuestionnaireResponse } from './questionnaire-response.entity';
import { QuestionnaireSubmission } from './questionnaire-submission.entity';
import { QuestionnaireTemplate } from './questionnaire-template.entity';
import { QuestionnaireTemplateVersion } from './questionnaire-template-version.entity';
import { QuestionnaireProfileProposal } from './questionnaire-profile-proposal.entity';
import { QuestionnaireResponseService } from './questionnaire-response.service';
import {
  completionPercent,
  EMPLOYEE_360_TEMPLATE_CODE,
} from './seed/employee-360-v1.schema';
import {
  canAttachAssignment,
  canCancelAssignment,
  canCloseAssignment,
  QUESTIONNAIRE_ASSIGNMENT_AUDIT,
} from './assignments/questionnaire-assignment-transitions';
import {
  computeDetailCapabilities,
  computeListLifecycleCapabilities,
} from './assignments/questionnaire-assignment-access';
import { attachmentStateForStatus } from './assignments/questionnaire-assignment-attachment-state';
import {
  applyDirectoryFilters,
  applyDirectoryScope,
  applyDirectorySort,
  type QuestionnaireDirectoryFilters,
  type QuestionnaireDirectoryScope,
} from './assignments/questionnaire-assignment-list.query';
import { Employee } from '../../organization/employees/employee.entity';
import { EmployeeContact } from '../../organization/employees/employee-contact.entity';
import { PERSONAL_CONTACT_TYPES } from '../../organization/employees/employee-personal-contacts';
import type {
  QuestionnaireAttachConstraint,
  QuestionnaireDirectoryQuery,
  QuestionnaireDirectoryResponse,
} from '@loom/contracts-questionnaires';
import { buildQuestionnaireProfileMirror } from './proposals/questionnaire-profile-mirror';
import { supersedePendingForAssignment } from './proposals/questionnaire-proposal-lifecycle';

@Injectable()
export class QuestionnaireAssignmentService {
  constructor(
    @InjectRepository(QuestionnaireAssignment)
    private readonly assignments: Repository<QuestionnaireAssignment>,
    @InjectRepository(QuestionnaireTemplate)
    private readonly templates: Repository<QuestionnaireTemplate>,
    @InjectRepository(QuestionnaireTemplateVersion)
    private readonly versions: Repository<QuestionnaireTemplateVersion>,
    @InjectRepository(QuestionnaireResponse)
    private readonly responses: Repository<QuestionnaireResponse>,
    @InjectRepository(QuestionnaireSubmission)
    private readonly submissions: Repository<QuestionnaireSubmission>,
    @InjectRepository(EmployeeContact)
    private readonly contacts: Repository<EmployeeContact>,
    private readonly access: EmployeeAccessService,
    private readonly users: UsersService,
    private readonly permissions: PermissionService,
    private readonly responseService: QuestionnaireResponseService,
    private readonly audit: AuditService,
    private readonly dataSource: DataSource,
  ) {}

  async create(
    actor: User,
    input: { employeeId?: string; dueAt?: string | null },
  ) {
    if (!this.permissions.has(actor.role, Permission.QuestionnairesAssign)) {
      throw new ForbiddenException('Cannot assign questionnaire');
    }

    const version = await this.resolveLatestPublishedTemplateVersion();

    let employee: Employee | null = null;
    if (input.employeeId) {
      employee = await this.resolveAttachableEmployee(actor, input.employeeId);
    }

    const assignment = await this.assignments.save(
      this.assignments.create({
        templateVersionId: version.id,
        employeeId: employee?.id ?? null,
        detachedFromEmployeeId: null,
        assignedByUserId: actor.id,
        status: employee ? 'assigned' : 'new',
        dueAt: input.dueAt ? new Date(input.dueAt) : null,
      }),
    );

    await this.responseService.ensureResponse(assignment.id);
    return this.getDetail(actor, assignment.id);
  }

  /**
   * Shared validation for attaching an employee to an assignment (create + attach):
   * the employee must exist, be viewable by the actor, and have an active linked user.
   */
  private async resolveAttachableEmployee(
    actor: User,
    employeeId: string,
  ): Promise<Employee> {
    const employee = await this.access.getEmployeeOrFail(employeeId);
    await this.access.requireCanView(actor, employee);

    if (!employee.userId) {
      throw new BadRequestException(
        'Cannot assign questionnaire: employee has no user account',
      );
    }
    const linkedUser = await this.users.findById(employee.userId);
    if (!linkedUser || linkedUser.status !== UserStatus.Active) {
      throw new BadRequestException(
        'Cannot assign questionnaire: employee has no active user account',
      );
    }
    return employee;
  }

  private async resolveLatestPublishedTemplateVersion(): Promise<QuestionnaireTemplateVersion> {
    const template = await this.templates.findOne({
      where: {
        code: EMPLOYEE_360_TEMPLATE_CODE,
        status: 'published',
        type: 'general',
      },
    });
    if (!template) {
      throw new NotFoundException(
        `Questionnaire template not found: ${EMPLOYEE_360_TEMPLATE_CODE}`,
      );
    }

    const version = await this.versions
      .createQueryBuilder('v')
      .where('v.template_id = :templateId', { templateId: template.id })
      .andWhere('v.published_at IS NOT NULL')
      .orderBy('v.version', 'DESC')
      .getOne();
    if (!version) {
      throw new NotFoundException('No published questionnaire template version');
    }
    return version;
  }

  async listByEmployee(actor: User, employeeId: string) {
    const employee = await this.access.getEmployeeOrFail(employeeId);
    await this.access.requireCanView(actor, employee);

    const canAssign = this.canAssign(actor);
    const isOwner = this.access.isOwner(actor, employee);
    if (
      !this.permissions.has(actor.role, Permission.QuestionnairesView) &&
      !isOwner
    ) {
      throw new ForbiddenException('Cannot view questionnaires');
    }

    const rows = await this.assignments.find({
      where: { employeeId, status: Not('cancelled') },
      relations: { templateVersion: { template: true } },
      order: { createdAt: 'DESC' },
    });

    const items = await Promise.all(rows.map((row) => this.toListItem(actor, row)));

    return {
      items,
      capabilities: { canAssign },
    };
  }

  async getDetail(actor: User, assignmentId: string) {
    const assignment = await this.loadAssignmentOrFail(assignmentId);
    const employee = assignment.employeeId
      ? await this.access.getEmployeeOrFail(assignment.employeeId)
      : null;
    await this.requireCanViewAssignment(actor, employee);

    const draft = await this.responses.findOne({
      where: { assignmentId: assignment.id },
    });
    const submissions = draft
      ? await this.submissions.find({
          where: { responseId: draft.id },
          order: { submissionNumber: 'DESC' },
        })
      : [];

    const schema = assignment.templateVersion.schemaJson as {
      code: string;
      version: number;
      title: string;
      steps: Array<{
        key: string;
        label: string;
        fields: Array<{ key: string; [k: string]: unknown }>;
      }>;
    };

    const caps = computeDetailCapabilities({
      actor,
      employee,
      status: assignment.status,
      permissions: this.permissions,
      access: this.access,
    });

    let profileMirror: Record<string, unknown> | null = null;
    if (
      employee &&
      (this.access.isOwner(actor, employee) || this.access.isAdmin(actor))
    ) {
      const contacts = await this.contacts.find({
        where: {
          employeeId: employee.id,
          type: In([...PERSONAL_CONTACT_TYPES]),
        },
      });
      profileMirror = buildQuestionnaireProfileMirror(employee, contacts);
    }

    return {
      id: assignment.id,
      employeeId: assignment.employeeId,
      employeeLastName: employee?.lastName ?? null,
      employeeFirstName: employee?.firstName ?? null,
      templateCode: assignment.templateVersion.template.code,
      templateTitle: assignment.templateVersion.template.title,
      templateType: assignment.templateVersion.template.type,
      version: assignment.templateVersion.version,
      status: assignment.status,
      dueAt: assignment.dueAt?.toISOString() ?? null,
      startedAt: assignment.startedAt?.toISOString() ?? null,
      submittedAt: assignment.submittedAt?.toISOString() ?? null,
      reviewedAt: assignment.reviewedAt?.toISOString() ?? null,
      createdAt: assignment.createdAt.toISOString(),
      schema,
      draft: draft
        ? {
            id: draft.id,
            answers: draft.answersJson ?? {},
            revision: draft.revision,
            updatedAt: draft.updatedAt.toISOString(),
          }
        : null,
      submissions: submissions.map((s) => ({
        id: s.id,
        submissionNumber: s.submissionNumber,
        submittedAt: s.submittedAt.toISOString(),
        reviewStatus: s.reviewStatus,
        reviewedAt: s.reviewedAt?.toISOString() ?? null,
        reviewComment: s.reviewComment,
      })),
      completionPercent: completionPercent(draft?.answersJson, schema),
      profileMirror,
      capabilities: caps,
    };
  }

  async cancel(actor: User, assignmentId: string) {
    await this.dataSource.transaction(async (manager) => {
      const assignment = await this.lockAssignment(manager, assignmentId);
      await this.requireAssignmentLifecycleAccess(actor, assignment);

      if (!canCancelAssignment(assignment.status)) {
        throw new ConflictException(
          `Cannot cancel assignment in status ${assignment.status}`,
        );
      }

      const previousEmployeeId = assignment.employeeId;
      const previousStatus = assignment.status;
      const now = new Date();
      assignment.detachedFromEmployeeId = previousEmployeeId;
      assignment.employeeId = null;
      assignment.status = 'cancelled';
      await manager.getRepository(QuestionnaireAssignment).save(assignment);
      await supersedePendingForAssignment(manager, assignment.id, now);

      await this.audit.record(
        {
          actorId: actor.id,
          action: QUESTIONNAIRE_ASSIGNMENT_AUDIT.cancelled,
          entityType: 'questionnaire_assignment',
          entityId: assignment.id,
          metadata: {
            assignmentId: assignment.id,
            previousEmployeeId,
            previousStatus,
          },
        },
        manager,
      );
    });

    return this.getDetail(actor, assignmentId);
  }

  async attach(
    actor: User,
    assignmentId: string,
    input: { employeeId: string },
  ) {
    await this.dataSource.transaction(async (manager) => {
      const assignment = await this.lockAssignment(manager, assignmentId);

      if (!this.permissions.has(actor.role, Permission.QuestionnairesAssign)) {
        throw new ForbiddenException('Cannot manage questionnaire assignment');
      }

      if (
        !canAttachAssignment({
          status: assignment.status,
          employeeId: assignment.employeeId,
          detachedFromEmployeeId: assignment.detachedFromEmployeeId,
        })
      ) {
        throw new ConflictException(
          `Cannot attach assignment in status ${assignment.status}`,
        );
      }

      const employee = await this.resolveAttachableEmployee(
        actor,
        input.employeeId,
      );

      if (
        assignment.status === 'cancelled' &&
        assignment.detachedFromEmployeeId !== employee.id
      ) {
        throw new BadRequestException(
          'Cancelled assignment can only be reattached to the previously detached employee',
        );
      }

      const attachKind: 'new' | 'same_employee_reattach' =
        assignment.status === 'cancelled' ? 'same_employee_reattach' : 'new';

      assignment.employeeId = employee.id;
      assignment.detachedFromEmployeeId = null;
      assignment.status = 'assigned';
      assignment.reviewedAt = null;
      await manager.getRepository(QuestionnaireAssignment).save(assignment);

      await this.audit.record(
        {
          actorId: actor.id,
          action: QUESTIONNAIRE_ASSIGNMENT_AUDIT.attached,
          entityType: 'questionnaire_assignment',
          entityId: assignment.id,
          metadata: {
            assignmentId: assignment.id,
            employeeId: employee.id,
            attachKind,
          },
        },
        manager,
      );
    });

    return this.getDetail(actor, assignmentId);
  }

  async close(actor: User, assignmentId: string) {
    await this.dataSource.transaction(async (manager) => {
      const assignment = await this.lockAssignment(manager, assignmentId);
      await this.requireAssignmentLifecycleAccess(actor, assignment, {
        allowUnattached: true,
      });

      if (!canCloseAssignment(assignment.status)) {
        throw new ConflictException(
          `Cannot close assignment in status ${assignment.status}`,
        );
      }

      const previousStatus = assignment.status;
      const now = new Date();
      assignment.status = 'closed';
      await manager.getRepository(QuestionnaireAssignment).save(assignment);
      await supersedePendingForAssignment(manager, assignment.id, now);

      await this.audit.record(
        {
          actorId: actor.id,
          action: QUESTIONNAIRE_ASSIGNMENT_AUDIT.closed,
          entityType: 'questionnaire_assignment',
          entityId: assignment.id,
          metadata: {
            assignmentId: assignment.id,
            employeeId: assignment.employeeId,
            detachedFromEmployeeId: assignment.detachedFromEmployeeId,
            previousStatus,
          },
        },
        manager,
      );
    });

    return this.getDetail(actor, assignmentId);
  }

  async listDirectory(
    actor: User,
    query: QuestionnaireDirectoryQuery,
  ): Promise<QuestionnaireDirectoryResponse> {
    if (!this.permissions.has(actor.role, Permission.QuestionnairesView)) {
      throw new ForbiddenException('Cannot view questionnaires');
    }

    const limit = Math.min(Math.max(query.limit ?? 50, 1), 100);
    const offset = Math.max(query.offset ?? 0, 0);
    const filters: QuestionnaireDirectoryFilters = {
      departmentId: query.departmentId,
      positionId: query.positionId,
      createdFrom: query.createdFrom,
      createdTo: query.createdTo,
      attachmentState: query.attachmentState,
      templateType: query.templateType,
      sortBy: query.sortBy,
      sortDir: query.sortDir,
      limit,
      offset,
    };

    const scope = await this.resolveDirectoryScope(actor);

    const baseQb = () => {
      const qb = this.assignments
        .createQueryBuilder('a')
        .innerJoin('a.templateVersion', 'tv')
        .innerJoin('tv.template', 'tmpl')
        .leftJoin(Employee, 'emp', 'emp.id = a.employee_id')
        .leftJoin(Employee, 'detached_emp', 'detached_emp.id = a.detached_from_employee_id')
        .leftJoin('emp.department', 'dept')
        .leftJoin('emp.position', 'pos')
        .leftJoin(
          QuestionnaireResponse,
          'resp',
          'resp.assignment_id = a.id',
        );
      applyDirectoryScope(qb, scope);
      applyDirectoryFilters(qb, filters);
      return qb;
    };

    const total = await baseQb().clone().select('a.id').distinct(true).getCount();

    const qb = baseQb()
      .select([
        'a.id AS id',
        'a.status AS status',
        'a.created_at AS "createdAt"',
        'a.updated_at AS "assignmentUpdatedAt"',
        'a.employee_id AS "employeeId"',
        'a.detached_from_employee_id AS "detachedFromEmployeeId"',
        'tmpl.code AS "templateCode"',
        'tmpl.title AS "templateTitle"',
        'tmpl.type AS "templateType"',
        'tv.version AS version',
        'emp.first_name AS "firstName"',
        'emp.last_name AS "lastName"',
        'emp.middle_name AS "middleName"',
        'detached_emp.first_name AS "detachedFirstName"',
        'detached_emp.last_name AS "detachedLastName"',
        'detached_emp.middle_name AS "detachedMiddleName"',
        'dept.name AS "departmentName"',
        'pos.name AS "positionName"',
        'resp.updated_at AS "responseUpdatedAt"',
      ]);
    applyDirectorySort(qb, filters.sortBy ?? 'createdAt', filters.sortDir ?? 'desc');
    qb.offset(offset).limit(limit);

    const rows = await qb.getRawMany<{
      id: string;
      status: string;
      createdAt: Date;
      assignmentUpdatedAt: Date;
      employeeId: string | null;
      detachedFromEmployeeId: string | null;
      templateCode: string;
      templateTitle: string;
      templateType: string;
      version: number;
      firstName: string | null;
      lastName: string | null;
      middleName: string | null;
      detachedFirstName: string | null;
      detachedLastName: string | null;
      detachedMiddleName: string | null;
      departmentName: string | null;
      positionName: string | null;
      responseUpdatedAt: Date | null;
    }>();

    const items = rows.map((row) => {
      const lifecycle = computeListLifecycleCapabilities({
        actor,
        status: row.status,
        employeeId: row.employeeId,
        detachedFromEmployeeId: row.detachedFromEmployeeId,
        permissions: this.permissions,
      });
      const assignmentUpdated = new Date(row.assignmentUpdatedAt).getTime();
      const responseUpdated = row.responseUpdatedAt
        ? new Date(row.responseUpdatedAt).getTime()
        : new Date(row.createdAt).getTime();
      const activityMs = Math.max(assignmentUpdated, responseUpdated);
      const employeeDisplayName = row.employeeId
        ? [row.lastName, row.firstName, row.middleName]
            .filter(Boolean)
            .join(' ')
        : null;

      let attachConstraint: QuestionnaireAttachConstraint = null;
      if (row.status === 'new') {
        attachConstraint = { kind: 'any_employee' };
      } else if (row.status === 'cancelled' && row.detachedFromEmployeeId) {
        attachConstraint = {
          kind: 'same_employee',
          employeeId: row.detachedFromEmployeeId,
          employeeDisplayName: [
            row.detachedLastName,
            row.detachedFirstName,
            row.detachedMiddleName,
          ]
            .filter(Boolean)
            .join(' '),
        };
      }

      return {
        id: row.id,
        templateCode: row.templateCode,
        templateTitle: row.templateTitle,
        templateType: row.templateType as QuestionnaireDirectoryResponse['items'][number]['templateType'],
        version: Number(row.version),
        employeeId: row.employeeId,
        employeeDisplayName,
        departmentName: row.departmentName,
        positionName: row.positionName,
        status: row.status as QuestionnaireDirectoryResponse['items'][number]['status'],
        attachmentState: attachmentStateForStatus(row.status),
        createdAt: new Date(row.createdAt).toISOString(),
        updatedAt: new Date(activityMs).toISOString(),
        attachConstraint,
        capabilities: {
          canOpen: lifecycle.canOpen,
          canAttach: lifecycle.canAttach,
          canCancel: lifecycle.canCancel,
          canClose: lifecycle.canClose,
          canDelete: lifecycle.canDelete,
        },
      };
    });

    return {
      items,
      total,
      limit,
      offset,
      capabilities: { canCreate: this.canAssign(actor) },
    };
  }

  private async resolveDirectoryScope(
    actor: User,
  ): Promise<QuestionnaireDirectoryScope> {
    if (this.access.isAdmin(actor)) {
      return { kind: 'all', includeUnattached: true };
    }
    if (this.access.scope(actor) === 'managed_departments') {
      const departmentIds = await this.access.managedDepartmentIds(actor);
      return {
        kind: 'departments_and_self',
        departmentIds,
        userId: actor.id,
        includeUnattached: false,
      };
    }
    return { kind: 'self', userId: actor.id, includeUnattached: false };
  }

  async deleteAssignment(actor: User, assignmentId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const assignment = await this.lockAssignment(manager, assignmentId);
      await this.requireAssignmentLifecycleAccess(actor, assignment, {
        allowUnattached: true,
      });

      const response = await manager.getRepository(QuestionnaireResponse).findOne({
        where: { assignmentId: assignment.id },
      });
      let submissionCount = 0;
      let proposalCount = 0;
      if (response) {
        submissionCount = await manager
          .getRepository(QuestionnaireSubmission)
          .count({ where: { responseId: response.id } });
        const submissionIds = (
          await manager.getRepository(QuestionnaireSubmission).find({
            where: { responseId: response.id },
            select: ['id'],
          })
        ).map((s) => s.id);
        if (submissionIds.length) {
          proposalCount = await manager
            .getRepository(QuestionnaireProfileProposal)
            .createQueryBuilder('p')
            .where('p.submission_id IN (:...ids)', { ids: submissionIds })
            .getCount();
        }
      }

      const template = assignment.templateVersion?.template;
      await this.audit.record(
        {
          actorId: actor.id,
          action: QUESTIONNAIRE_ASSIGNMENT_AUDIT.deleted,
          entityType: 'questionnaire_assignment',
          entityId: assignment.id,
          metadata: {
            assignmentId: assignment.id,
            employeeId: assignment.employeeId,
            detachedFromEmployeeId: assignment.detachedFromEmployeeId,
            templateCode: template?.code ?? null,
            version: assignment.templateVersion?.version ?? null,
            previousStatus: assignment.status,
            responseId: response?.id ?? null,
            submissionCount,
            proposalCount,
            actorUserId: actor.id,
          },
        },
        manager,
      );

      const result = await manager
        .getRepository(QuestionnaireAssignment)
        .delete(assignment.id);
      if (result.affected !== 1) {
        throw new NotFoundException('Assignment not found');
      }
    });
  }

  async loadAssignmentOrFail(id: string): Promise<QuestionnaireAssignment> {
    const assignment = await this.assignments.findOne({
      where: { id },
      relations: { templateVersion: { template: true } },
    });
    if (!assignment) throw new NotFoundException('Assignment not found');
    return assignment;
  }

  private async lockAssignment(
    manager: EntityManager,
    assignmentId: string,
  ): Promise<QuestionnaireAssignment> {
    const locked = await manager
      .getRepository(QuestionnaireAssignment)
      .createQueryBuilder('a')
      .setLock('pessimistic_write')
      .where('a.id = :id', { id: assignmentId })
      .getOne();
    if (!locked) throw new NotFoundException('Assignment not found');

    const withRelations = await manager.getRepository(QuestionnaireAssignment).findOne({
      where: { id: locked.id },
      relations: { templateVersion: { template: true } },
    });
    if (!withRelations) throw new NotFoundException('Assignment not found');
    return withRelations;
  }

  /**
   * Permission + view-scope guard for cancel/close/delete.
   * Unattached assignments (employeeId null) have no employee to scope
   * against; callers must opt in via allowUnattached (close/delete). Cancel
   * only reaches attached assignments (enforced by canCancelAssignment), so
   * a null employeeId there indicates a data inconsistency.
   */
  private async requireAssignmentLifecycleAccess(
    actor: User,
    assignment: QuestionnaireAssignment,
    options: { allowUnattached: boolean } = { allowUnattached: false },
  ): Promise<void> {
    if (!this.permissions.has(actor.role, Permission.QuestionnairesAssign)) {
      throw new ForbiddenException('Cannot manage questionnaire assignment');
    }
    if (!assignment.employeeId) {
      if (options.allowUnattached) return;
      throw new ConflictException('Assignment has no attached employee');
    }
    const employee = await this.access.getEmployeeOrFail(assignment.employeeId);
    await this.access.requireCanView(actor, employee);
  }

  private canAssign(actor: User): boolean {
    return this.permissions.has(actor.role, Permission.QuestionnairesAssign);
  }

  private async requireCanViewAssignment(
    actor: User,
    employee: Employee | null,
  ): Promise<void> {
    if (!employee) {
      if (!this.permissions.has(actor.role, Permission.QuestionnairesAssign)) {
        throw new ForbiddenException('Cannot view questionnaires');
      }
      return;
    }
    await this.access.requireCanView(actor, employee);
    const isOwner = this.access.isOwner(actor, employee);
    if (
      !isOwner &&
      !this.permissions.has(actor.role, Permission.QuestionnairesView)
    ) {
      throw new ForbiddenException('Cannot view questionnaires');
    }
  }

  private async toListItem(actor: User, row: QuestionnaireAssignment) {
    const draft = await this.responses.findOne({
      where: { assignmentId: row.id },
    });
    let latestSubmission = null;
    if (draft) {
      const sub = await this.submissions.findOne({
        where: { responseId: draft.id },
        order: { submissionNumber: 'DESC' },
      });
      if (sub) {
        latestSubmission = {
          id: sub.id,
          submissionNumber: sub.submissionNumber,
          submittedAt: sub.submittedAt.toISOString(),
          reviewStatus: sub.reviewStatus,
          reviewedAt: sub.reviewedAt?.toISOString() ?? null,
          reviewComment: sub.reviewComment,
        };
      }
    }

    const schema = row.templateVersion.schemaJson as {
      steps: Array<{ fields: Array<{ key: string }> }>;
    };

    const lifecycle = computeListLifecycleCapabilities({
      actor,
      status: row.status,
      employeeId: row.employeeId,
      detachedFromEmployeeId: row.detachedFromEmployeeId,
      permissions: this.permissions,
    });

    return {
      id: row.id,
      employeeId: row.employeeId,
      templateCode: row.templateVersion.template.code,
      templateTitle: row.templateVersion.template.title,
      templateType: row.templateVersion.template.type,
      version: row.templateVersion.version,
      status: row.status,
      dueAt: row.dueAt?.toISOString() ?? null,
      startedAt: row.startedAt?.toISOString() ?? null,
      submittedAt: row.submittedAt?.toISOString() ?? null,
      reviewedAt: row.reviewedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      completionPercent: completionPercent(draft?.answersJson, schema),
      latestSubmission,
      capabilities: {
        canOpen: lifecycle.canOpen,
        canAssign: lifecycle.canAssign,
        canCancel: lifecycle.canCancel,
        canClose: lifecycle.canClose,
        canDelete: lifecycle.canDelete,
      },
    };
  }
}
