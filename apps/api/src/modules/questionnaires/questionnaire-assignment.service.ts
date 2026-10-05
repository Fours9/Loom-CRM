import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { User } from '../../platform/identity/user.entity';
import { AuthorizationContextService } from '../../platform/access-control/authorization-context.service';
import type { AuthorizationContext } from '../../platform/access-control/authorization-context';
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
  isOwnerEditableStatus,
  QUESTIONNAIRE_ASSIGNMENT_AUDIT,
} from './assignments/questionnaire-assignment-transitions';
import {
  computeDetailCapabilities,
  computeListLifecycleCapabilities,
  canAssignQuestionnaires,
  canManageLifecycle,
  canDeleteQuestionnaire,
  canViewQuestionnaires,
  canReadUnattachedNewPool,
  canReadAssignmentComment,
  requireActorAccessAssignmentTemplate,
  applyGrantedTemplateCodeFilter,
  filterByGrantedTemplateCodes,
} from './assignments/questionnaire-assignment-access';
import { attachmentStateForStatus } from './assignments/questionnaire-assignment-attachment-state';
import {
  parseAssignmentContext,
  toSubmissionSummaryDto,
} from './reopen/questionnaire-reopen-transition';
import {
  applyDirectoryFilters,
  applyDirectoryScope,
  applyDirectorySort,
  applyAssignmentFilters,
  applyEmployeeScope,
  type QuestionnaireDirectoryFilters,
  type QuestionnaireDirectoryScope,
  type QuestionnaireAssignmentCommonFilters,
} from './assignments/questionnaire-assignment-list.query';
import {
  allocateNextAssignmentCode,
  questionnaireAssignmentCodePrefix,
} from './assignments/questionnaire-assignment-code';
import { resolveCrossEmployeeReattachMutation } from './assignments/cross-employee-reattach-mutation';
import type {
  QuestionnaireAttachConstraint,
  QuestionnaireDirectoryQuery,
  QuestionnaireDirectoryResponse,
  QuestionnaireTemplateListResponse,
} from '@loom/contracts-questionnaires';
import { parseQuestionnaireContext } from '@loom/contracts-questionnaires';
import { Employee } from '../../organization/employees/employee.entity';
import { EmployeeContactsFacade } from '../../organization/employees/employee-contacts.facade';
import { CurrentEmploymentAssignmentResolver } from '../../organization/employment-catalog/current-employment-assignment.resolver';
import { PositionCatalogFacade } from '../../organization/position-catalog/position-catalog.facade';
import { buildQuestionnaireProfileMirror } from './proposals/questionnaire-profile-mirror';
import { supersedePendingForAssignment } from './proposals/questionnaire-proposal-lifecycle';
import { QuestionnaireContextSkillIdBackfillService } from './assignments/questionnaire-context-skill-id-backfill.service';
import { applyCanonicalOrganizationAnswers } from './questionnaire-organization-selection';
import { QuestionnaireSubmissionService } from './questionnaire-submission.service';
import {
  desiredExtrasFromPersistedContext,
  syncLocked,
} from './questionnaire-position-context-sync.core';

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
    private readonly contactsFacade: EmployeeContactsFacade,
    private readonly positionCatalog: PositionCatalogFacade,
    private readonly currentEmployment: CurrentEmploymentAssignmentResolver,
    private readonly contextSkillIdBackfill: QuestionnaireContextSkillIdBackfillService,
    private readonly access: EmployeeAccessService,
    private readonly authorization: AuthorizationContextService,
    private readonly responseService: QuestionnaireResponseService,
    private readonly submissionService: QuestionnaireSubmissionService,
    private readonly audit: AuditService,
    private readonly dataSource: DataSource,
  ) {}

  async create(
    actor: User,
    input: {
      employeeId?: string;
      templateCode?: string;
      title?: string | null;
      comment?: string | null;
      dueAt?: string | null;
    },
  ) {
    const authz = await this.authorization.resolve(actor.id);
    if (!canAssignQuestionnaires(authz)) {
      throw new ForbiddenException('Cannot assign questionnaire');
    }

    const templateCode =
      input.templateCode?.trim() || EMPLOYEE_360_TEMPLATE_CODE;
    requireActorAccessAssignmentTemplate({ authz, templateCode });
    const comment =
      typeof input.comment === 'string' && input.comment.trim()
        ? input.comment.trim()
        : null;
    const customTitle =
      typeof input.title === 'string' && input.title.trim()
        ? input.title.trim()
        : null;

    const assignmentId = await this.dataSource.transaction(async (manager) => {
      const version =
        await this.resolveLatestPublishedTemplateVersion(templateCode);
      const template = version.template;
      if (!template) {
        const loaded = await manager
          .getRepository(QuestionnaireTemplate)
          .findOne({ where: { id: version.templateId } });
        if (!loaded) {
          throw new NotFoundException(
            `Questionnaire template not found for version`,
          );
        }
        version.template = loaded;
      }

      let employee: Employee | null = null;
      if (input.employeeId) {
        employee = await this.resolveAttachableEmployee(actor, input.employeeId);
      }

      const prefix = questionnaireAssignmentCodePrefix(
        version.template.code,
        version.template.type,
      );
      const code = await allocateNextAssignmentCode(manager, prefix);

      let contextJson: Record<string, unknown> | null = null;
      if (employee) {
        contextJson = (await this.positionCatalog.buildSnapshotForEmployee(
          employee.id,
          manager,
        )) as Record<string, unknown>;
      }

      const assignment = await manager
        .getRepository(QuestionnaireAssignment)
        .save(
          manager.getRepository(QuestionnaireAssignment).create({
            templateVersionId: version.id,
            code,
            title: customTitle,
            comment,
            employeeId: employee?.id ?? null,
            detachedFromEmployeeId: null,
            assignedByUserId: actor.id,
            status: employee ? 'assigned' : 'new',
            dueAt: input.dueAt ? new Date(input.dueAt) : null,
            contextJson,
          }),
        );

      await this.responseService.ensureResponse(assignment.id, manager);
      if (contextJson) {
        await this.seedCompanyWorkAnswersFromContext(
          assignment.id,
          contextJson,
          manager,
        );
      }
      return assignment.id;
    });

    return this.getDetail(actor, assignmentId);
  }

  async listPublishableTemplates(
    actor: User,
  ): Promise<QuestionnaireTemplateListResponse> {
    const authz = await this.authorization.resolve(actor.id);
    if (!canAssignQuestionnaires(authz)) {
      throw new ForbiddenException('Cannot list questionnaire templates');
    }

    const rows = await this.templates
      .createQueryBuilder('tmpl')
      .innerJoin(
        QuestionnaireTemplateVersion,
        'v',
        'v.template_id = tmpl.id AND v.published_at IS NOT NULL',
      )
      .where('tmpl.status = :status', { status: 'published' })
      .select([
        'tmpl.code AS code',
        'tmpl.title AS title',
        'tmpl.type AS type',
        'MAX(v.version) AS version',
      ])
      .groupBy('tmpl.id')
      .addGroupBy('tmpl.code')
      .addGroupBy('tmpl.title')
      .addGroupBy('tmpl.type')
      .orderBy('tmpl.title', 'ASC')
      .getRawMany<{
        code: string;
        title: string;
        type: string;
        version: string;
      }>();

    const items = filterByGrantedTemplateCodes(
      rows.map((r) => ({
        code: r.code,
        title: r.title,
        type: r.type as QuestionnaireTemplateListResponse['items'][number]['type'],
        version: Number(r.version),
        templateCode: r.code,
      })),
      authz,
    );

    return {
      items: items.map(({ templateCode: _tc, ...rest }) => rest),
    };
  }

  /**
   * Shared validation for attaching an employee to an assignment (create + attach):
   * the employee must exist and be viewable by the actor.
   * A linked User is not required — fill uses owner (active User) or CompleteAny on behalf.
   */
  private async resolveAttachableEmployee(
    actor: User,
    employeeId: string,
  ): Promise<Employee> {
    const employee = await this.access.getEmployeeOrFail(employeeId);
    await this.access.requireCanView(actor, employee);
    return employee;
  }

  private async resolveLatestPublishedTemplateVersion(
    templateCode: string = EMPLOYEE_360_TEMPLATE_CODE,
  ): Promise<QuestionnaireTemplateVersion> {
    const template = await this.templates.findOne({
      where: {
        code: templateCode,
        status: 'published',
      },
    });
    if (!template) {
      throw new NotFoundException(
        `Questionnaire template not found or not published: ${templateCode}`,
      );
    }

    const version = await this.versions
      .createQueryBuilder('v')
      .leftJoinAndSelect('v.template', 'tmpl')
      .where('v.template_id = :templateId', { templateId: template.id })
      .andWhere('v.published_at IS NOT NULL')
      .orderBy('v.version', 'DESC')
      .getOne();
    if (!version) {
      throw new NotFoundException(
        `No published questionnaire template version for ${templateCode}`,
      );
    }
    if (!version.template) {
      version.template = template;
    }
    return version;
  }

  async listByEmployee(
    actor: User,
    employeeId: string,
    filters: QuestionnaireAssignmentCommonFilters = {},
  ) {
    const authz = await this.authorization.resolve(actor.id);
    const employee = await this.access.getEmployeeOrFail(employeeId);
    await this.access.requireCanView(actor, employee);

    const canAssign = canAssignQuestionnaires(authz);
    const isOwner = this.access.isOwner(actor, employee);
    if (!canViewQuestionnaires(authz) && !isOwner) {
      throw new ForbiddenException('Cannot view questionnaires');
    }

    const qb = this.assignments
      .createQueryBuilder('a')
      .innerJoinAndSelect('a.templateVersion', 'tv')
      .innerJoinAndSelect('tv.template', 'tmpl');
    applyEmployeeScope(qb, employeeId);
    applyAssignmentFilters(qb, filters, { includeAttachmentState: false });
    applyGrantedTemplateCodeFilter(qb, authz);
    qb.orderBy('a.created_at', 'DESC').addOrderBy('a.id', 'ASC');

    const rows = await qb.getMany();
    const items = await Promise.all(
      rows.map((row) => this.toListItem(actor, authz, row, employee)),
    );

    return {
      items,
      capabilities: { canAssign },
    };
  }

  async getDetail(actor: User, assignmentId: string) {
    const authz = await this.authorization.resolve(actor.id);
    const assignment = await this.loadAssignmentOrFail(assignmentId);
    await this.requireCanViewAssignment(actor, assignment, authz);
    const employee = assignment.employeeId
      ? await this.access.getEmployeeOrFail(assignment.employeeId)
      : null;
    requireActorAccessAssignmentTemplate({
      authz,
      templateCode: assignment.templateVersion.template.code,
    });

    const draft = await this.responses.findOne({
      where: { assignmentId: assignment.id },
    });
    const submissions = draft
      ? await this.submissions.find({
          where: { responseId: draft.id },
          order: { submissionNumber: 'DESC' },
        })
      : [];

    const repairedAssignment = await this.contextSkillIdBackfill.repairContextJson(
      assignment.contextJson,
    );
    if (repairedAssignment.changed && repairedAssignment.contextJson) {
      assignment.contextJson = repairedAssignment.contextJson;
      await this.assignments.save(assignment);
    }

    for (const submission of submissions) {
      const repairedSubmission =
        await this.contextSkillIdBackfill.repairContextJson(
          submission.contextJson,
        );
      if (repairedSubmission.changed && repairedSubmission.contextJson) {
        submission.contextJson = repairedSubmission.contextJson;
        await this.submissions.save(submission);
      }
    }

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
      authz,
      actor,
      employee,
      status: assignment.status,
      access: this.access,
      latestSubmission: submissions[0] ?? null,
    });
    const canViewAssignmentComment = canReadAssignmentComment(authz);

    let profileMirror: Record<string, unknown> | null = null;
    if (employee) {
      profileMirror = await this.buildProfileMirrorForEmployee(actor, employee);
    }

    return {
      id: assignment.id,
      code: assignment.code,
      employeeId: assignment.employeeId,
      employeeLastName: employee?.lastName ?? null,
      employeeFirstName: employee?.firstName ?? null,
      templateCode: assignment.templateVersion.template.code,
      templateTitle: assignmentDisplayTitle(assignment),
      templateType: assignment.templateVersion.template.type,
      version: assignment.templateVersion.version,
      status: assignment.status,
      dueAt: assignment.dueAt?.toISOString() ?? null,
      startedAt: assignment.startedAt?.toISOString() ?? null,
      submittedAt: assignment.submittedAt?.toISOString() ?? null,
      reviewedAt: assignment.reviewedAt?.toISOString() ?? null,
      createdAt: assignment.createdAt.toISOString(),
      ...(canViewAssignmentComment
        ? { comment: assignment.comment ?? null }
        : {}),
      schema,
      draft: draft
        ? {
            id: draft.id,
            answers: draft.answersJson ?? {},
            revision: draft.revision,
            updatedAt: draft.updatedAt.toISOString(),
          }
        : null,
      submissions: submissions.map((s) => toSubmissionSummaryDto(s)),
      completionPercent: completionPercent(draft?.answersJson, schema),
      profileMirror,
      context: parseAssignmentContext(assignment.contextJson, {
        assignmentId: assignment.id,
      }),
      capabilities: {
        ...caps,
        canViewAssignmentComment,
      },
    };
  }

  /**
   * Canonical profileMirror for detail + draft PDF (same ACL as getDetail).
   */
  async buildProfileMirrorForEmployee(
    actor: User,
    employee: Employee,
  ): Promise<Record<string, unknown> | null> {
    const includePersonal = this.access.canViewPersonalContacts(
      actor,
      employee,
    );
    const includeEmployment =
      this.access.isOwner(actor, employee) ||
      this.access.isAdmin(actor) ||
      (await this.access.canViewEmployeeProfile(actor, employee));

    if (!includePersonal && !includeEmployment) {
      return null;
    }

    let employment = null;
    if (includeEmployment) {
      const ea = await this.currentEmployment.resolve(employee);
      employment = ea
        ? {
            directionId: ea.directionId,
            departmentId: ea.departmentId,
            positionId: ea.positionId,
            workFormat: ea.workFormat,
            employmentType: ea.employmentType,
            startDate: ea.startDate,
            probationEndDate: ea.probationEndDate,
          }
        : {
            directionId: null,
            departmentId: employee.departmentId,
            positionId: employee.positionId,
            workFormat: null,
            employmentType: null,
            startDate: null,
            probationEndDate: null,
          };
    }

    const contactsBundle = includePersonal
      ? await this.contactsFacade.readContactsBundle(
          this.dataSource.manager,
          employee.id,
        )
      : null;

    return buildQuestionnaireProfileMirror(
      {
        ...employee,
        workEmail: employee.workEmail,
        workPhone: employee.phoneNumber,
        workTelegram: employee.telegram,
      },
      [],
      contactsBundle,
      {
        includePersonal,
        includeEmployment,
        employment,
      },
    );
  }

  async listPrintableTemplates(
    actor: User,
  ): Promise<QuestionnaireTemplateListResponse> {
    const authz = await this.authorization.resolve(actor.id);
    if (!canViewQuestionnaires(authz)) {
      throw new ForbiddenException('Cannot list printable questionnaire templates');
    }

    const rows = await this.templates
      .createQueryBuilder('tmpl')
      .innerJoin(
        QuestionnaireTemplateVersion,
        'v',
        'v.template_id = tmpl.id AND v.published_at IS NOT NULL',
      )
      .where('tmpl.status = :status', { status: 'published' })
      .select([
        'tmpl.code AS code',
        'tmpl.title AS title',
        'tmpl.type AS type',
        'MAX(v.version) AS version',
      ])
      .groupBy('tmpl.id')
      .addGroupBy('tmpl.code')
      .addGroupBy('tmpl.title')
      .addGroupBy('tmpl.type')
      .orderBy('tmpl.title', 'ASC')
      .getRawMany<{
        code: string;
        title: string;
        type: string;
        version: string;
      }>();

    const items = filterByGrantedTemplateCodes(
      rows.map((r) => ({
        code: r.code,
        title: r.title,
        type: r.type as QuestionnaireTemplateListResponse['items'][number]['type'],
        version: Number(r.version),
        templateCode: r.code,
      })),
      authz,
    );

    return {
      items: items.map(({ templateCode: _tc, ...rest }) => rest),
    };
  }

  async cancel(actor: User, assignmentId: string) {
    const authz = await this.authorization.resolve(actor.id);
    await this.dataSource.transaction(async (manager) => {
      const assignment = await this.lockAssignment(manager, assignmentId);
      await this.requireManageLifecycleAccess(actor, assignment, authz);
      requireActorAccessAssignmentTemplate({
        authz,
        templateCode: assignment.templateVersion.template.code,
      });

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
    const authz = await this.authorization.resolve(actor.id);
    await this.dataSource.transaction(async (manager) => {
      const assignment = await this.lockAssignment(manager, assignmentId);

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

      if (assignment.status === 'new') {
        if (!canAssignQuestionnaires(authz)) {
          throw new ForbiddenException('Cannot attach questionnaire assignment');
        }
      } else if (assignment.status === 'cancelled') {
        if (!canManageLifecycle(authz)) {
          throw new ForbiddenException('Cannot reattach questionnaire assignment');
        }
        if (assignment.detachedFromEmployeeId) {
          const previous = await this.access.getEmployeeOrFail(
            assignment.detachedFromEmployeeId,
          );
          await this.access.requireCanView(actor, previous);
        }
      } else {
        throw new ForbiddenException('Cannot attach questionnaire assignment');
      }

      const employee = await this.resolveAttachableEmployee(
        actor,
        input.employeeId,
      );
      requireActorAccessAssignmentTemplate({
        authz,
        templateCode: assignment.templateVersion.template.code,
      });

      const previousDetachedEmployeeId = assignment.detachedFromEmployeeId;
      const attachKind: 'new' | 'reattach' =
        assignment.status === 'cancelled' ? 'reattach' : 'new';

      const sameEmployeeReattach =
        attachKind === 'reattach' &&
        previousDetachedEmployeeId != null &&
        previousDetachedEmployeeId === employee.id;

      const crossEmployeeReattach =
        attachKind === 'reattach' && !sameEmployeeReattach;

      await this.responseService.ensureResponse(assignment.id, manager);
      const response = await manager
        .getRepository(QuestionnaireResponse)
        .findOne({
          where: { assignmentId: assignment.id },
          lock: { mode: 'pessimistic_write' },
        });
      if (!response) {
        throw new ConflictException('Questionnaire response missing');
      }

      if (crossEmployeeReattach) {
        const nextContext = (await this.positionCatalog.buildSnapshotForEmployee(
          employee.id,
          manager,
        )) as Record<string, unknown>;
        const mutation = resolveCrossEmployeeReattachMutation({
          answersJson: response.answersJson,
          nextContext,
        });
        assignment.contextJson = mutation.nextContext;
        assignment.employeeId = employee.id;
        assignment.detachedFromEmployeeId = null;
        assignment.status = 'assigned';
        assignment.startedAt = null;
        assignment.submittedAt = null;
        assignment.reviewedAt = null;
        response.answersJson = mutation.nextAnswers;
        response.revision = response.revision + 1;
        await manager.getRepository(QuestionnaireAssignment).save(assignment);
        await manager.getRepository(QuestionnaireResponse).save(response);
      } else {
        if (!sameEmployeeReattach) {
          assignment.contextJson =
            (await this.positionCatalog.buildSnapshotForEmployee(
              employee.id,
              manager,
            )) as Record<string, unknown>;
        }

        assignment.employeeId = employee.id;
        assignment.detachedFromEmployeeId = null;
        assignment.status = 'assigned';
        assignment.reviewedAt = null;
        await manager.getRepository(QuestionnaireAssignment).save(assignment);

        if (!sameEmployeeReattach && assignment.contextJson) {
          await this.seedCompanyWorkAnswersFromContext(
            assignment.id,
            assignment.contextJson,
            manager,
          );
        }
      }

      await this.audit.record(
        {
          actorId: actor.id,
          action: QUESTIONNAIRE_ASSIGNMENT_AUDIT.attached,
          entityType: 'questionnaire_assignment',
          entityId: assignment.id,
          metadata: {
            assignmentId: assignment.id,
            fromEmployeeId: previousDetachedEmployeeId,
            toEmployeeId: employee.id,
            attachKind,
          },
        },
        manager,
      );
    });

    return this.getDetail(actor, assignmentId);
  }

  async close(actor: User, assignmentId: string) {
    const authz = await this.authorization.resolve(actor.id);
    await this.dataSource.transaction(async (manager) => {
      const assignment = await this.lockAssignment(manager, assignmentId);
      await this.requireManageLifecycleAccess(actor, assignment, authz, {
        allowUnattached: true,
      });
      requireActorAccessAssignmentTemplate({
        authz,
        templateCode: assignment.templateVersion.template.code,
      });

      if (!canCloseAssignment(assignment.status)) {
        throw new ConflictException(
          `Cannot close assignment in status ${assignment.status}`,
        );
      }

      const previousStatus = assignment.status;
      const now = new Date();
      const shouldSubmit =
        isOwnerEditableStatus(previousStatus) &&
        !!assignment.employeeId;

      let submissionId: string | null = null;
      let submissionNumber: number | null = null;
      let submittedViaClose = false;

      if (shouldSubmit) {
        const lockedResponse = await manager
          .getRepository(QuestionnaireResponse)
          .findOne({
            where: { assignmentId: assignment.id },
            lock: { mode: 'pessimistic_write' },
          });

        if (lockedResponse) {
          // Supersede OLD pending before creating new proposals.
          await supersedePendingForAssignment(manager, assignment.id, now);

          const templateType = assignment.templateVersion.template.type;
          if (templateType === 'managing') {
            await syncLocked(
              manager,
              assignment,
              lockedResponse,
              {
                desiredExtraSkillCodes: desiredExtrasFromPersistedContext(
                  assignment.contextJson,
                ),
              },
              this.positionCatalog,
            );
          } else {
            lockedResponse.revision = lockedResponse.revision + 1;
            await manager
              .getRepository(QuestionnaireResponse)
              .save(lockedResponse);
          }

          const submission =
            await this.submissionService.submitWithinTransaction(
              manager,
              actor,
              assignment,
              lockedResponse,
            );
          submissionId = submission.id;
          submissionNumber = submission.submissionNumber;
          submittedViaClose = true;

          // Never call supersede after new proposals — leave them pending.
          assignment.status = 'closed';
          await manager.getRepository(QuestionnaireAssignment).save(assignment);
        } else {
          assignment.status = 'closed';
          await manager.getRepository(QuestionnaireAssignment).save(assignment);
          await supersedePendingForAssignment(manager, assignment.id, now);
        }
      } else {
        assignment.status = 'closed';
        await manager.getRepository(QuestionnaireAssignment).save(assignment);
        await supersedePendingForAssignment(manager, assignment.id, now);
      }

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
            ...(submittedViaClose
              ? {
                  submittedViaClose: true,
                  submissionId,
                  submissionNumber,
                }
              : {}),
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
    const authz = await this.authorization.resolve(actor.id);
    if (!canViewQuestionnaires(authz)) {
      throw new ForbiddenException('Cannot view questionnaires');
    }

    const limit = Math.min(Math.max(query.limit ?? 50, 1), 100);
    const offset = Math.max(query.offset ?? 0, 0);
    const filters: QuestionnaireDirectoryFilters = {
      departmentId: query.departmentId,
      positionId: query.positionId,
      departmentIds: query.departmentIds,
      positionIds: query.positionIds,
      createdFrom: query.createdFrom,
      createdTo: query.createdTo,
      attachmentState: query.attachmentState,
      attachmentStates: query.attachmentStates,
      templateType: query.templateType,
      templateTypes: query.templateTypes,
      code: query.code,
      status: query.status,
      statuses: query.statuses,
      sortBy: query.sortBy,
      sortDir: query.sortDir,
      limit,
      offset,
    };

    const scope = await this.resolveDirectoryScope(actor, authz);

    const baseQb = () => {
      const qb = this.assignments
        .createQueryBuilder('a')
        .innerJoin('a.templateVersion', 'tv')
        .innerJoin('tv.template', 'tmpl')
        .leftJoin(Employee, 'emp', 'emp.id = a.employee_id')
        .leftJoin(
          Employee,
          'detached_emp',
          'detached_emp.id = a.detached_from_employee_id',
        )
        .leftJoin('emp.department', 'dept')
        .leftJoin('emp.position', 'pos')
        .leftJoin(
          QuestionnaireResponse,
          'resp',
          'resp.assignment_id = a.id',
        );
      applyDirectoryScope(qb, scope);
      applyGrantedTemplateCodeFilter(qb, authz);
      applyDirectoryFilters(qb, filters);
      return qb;
    };

    const total = await baseQb().clone().select('a.id').distinct(true).getCount();

    const qb = baseQb()
      .select([
        'a.id AS id',
        'a.code AS code',
        'a.comment AS comment',
        'a.status AS status',
        'a.created_at AS "createdAt"',
        'a.updated_at AS "assignmentUpdatedAt"',
        'a.employee_id AS "employeeId"',
        'a.detached_from_employee_id AS "detachedFromEmployeeId"',
        'tmpl.code AS "templateCode"',
        'COALESCE(NULLIF(TRIM(a.title), \'\'), tmpl.title) AS "templateTitle"',
        'tmpl.type AS "templateType"',
        'tv.version AS version',
        'emp.first_name AS "firstName"',
        'emp.last_name AS "lastName"',
        'emp.middle_name AS "middleName"',
        'emp.user_id AS "employeeUserId"',
        'dept.name AS "departmentName"',
        'pos.name AS "positionName"',
        'resp.id AS "responseId"',
        'resp.updated_at AS "responseUpdatedAt"',
      ]);
    applyDirectorySort(qb, filters.sortBy ?? 'createdAt', filters.sortDir ?? 'desc');
    qb.offset(offset).limit(limit);

    const rows = await qb.getRawMany<{
      id: string;
      code: string;
      comment: string | null;
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
      employeeUserId: string | null;
      departmentName: string | null;
      positionName: string | null;
      responseId: string | null;
      responseUpdatedAt: Date | null;
    }>();

    const latestByResponseId = await this.latestSubmissionByResponseIds(
      rows.map((r) => r.responseId).filter((id): id is string => !!id),
    );

    const canViewAssignmentComment = canReadAssignmentComment(authz);

    const items = rows.map((row) => {
      const latestSubmission = row.responseId
        ? (latestByResponseId.get(row.responseId) ?? null)
        : null;
      const employee = row.employeeId
        ? ({
            id: row.employeeId,
            userId: row.employeeUserId,
          } as Employee)
        : null;
      const lifecycle = computeListLifecycleCapabilities({
        authz,
        actor,
        status: row.status,
        employeeId: row.employeeId,
        detachedFromEmployeeId: row.detachedFromEmployeeId,
        employee,
        access: this.access,
        hasLatestSubmission: latestSubmission != null,
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
      if (
        (row.status === 'new' || row.status === 'cancelled') &&
        !row.employeeId
      ) {
        attachConstraint = { kind: 'any_employee' };
      }

      return {
        id: row.id,
        code: row.code,
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
        ...(canViewAssignmentComment ? { comment: row.comment ?? null } : {}),
        latestSubmission,
        attachConstraint,
        capabilities: {
          canOpen: lifecycle.canOpen,
          canAttach: lifecycle.canAttach,
          canCancel: lifecycle.canCancel,
          canClose: lifecycle.canClose,
          canDelete: lifecycle.canDelete,
          canStartFill: lifecycle.canStartFill,
        },
      };
    });

    return {
      items,
      total,
      limit,
      offset,
      capabilities: { canCreate: canAssignQuestionnaires(authz) },
    };
  }

  private async resolveDirectoryScope(
    actor: User,
    authz: AuthorizationContext,
  ): Promise<QuestionnaireDirectoryScope> {
    if (this.access.isAdmin(actor)) {
      return { kind: 'all' };
    }
    const ctx = await this.access.resolveActorContext(actor);
    if (ctx.scope === 'managed_departments') {
      return {
        kind: 'departments_and_self',
        departmentIds: ctx.managedDepartmentIds,
        userId: actor.id,
        includeNewUnattached: canReadUnattachedNewPool(authz),
      };
    }
    return {
      kind: 'self',
      userId: actor.id,
    };
  }

  async deleteAssignment(actor: User, assignmentId: string): Promise<void> {
    const authz = await this.authorization.resolve(actor.id);
    await this.dataSource.transaction(async (manager) => {
      const assignment = await this.lockAssignment(manager, assignmentId);
      await this.requireDeleteAccess(actor, assignment, authz);
      requireActorAccessAssignmentTemplate({
        authz,
        templateCode: assignment.templateVersion.template.code,
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
   * ManageLifecycle + employee/detached scope for cancel/close.
   */
  private async requireManageLifecycleAccess(
    actor: User,
    assignment: QuestionnaireAssignment,
    authz: AuthorizationContext,
    options: { allowUnattached: boolean } = { allowUnattached: false },
  ): Promise<void> {
    if (!canManageLifecycle(authz)) {
      throw new ForbiddenException('Cannot manage questionnaire assignment');
    }
    await this.requireScopeForAssignment(actor, assignment, options);
  }

  private async requireDeleteAccess(
    actor: User,
    assignment: QuestionnaireAssignment,
    authz: AuthorizationContext,
  ): Promise<void> {
    if (!canDeleteQuestionnaire(authz)) {
      throw new ForbiddenException('Cannot delete questionnaire assignment');
    }
    await this.requireScopeForAssignment(actor, assignment, {
      allowUnattached: true,
    });
  }

  private async requireScopeForAssignment(
    actor: User,
    assignment: QuestionnaireAssignment,
    options: { allowUnattached: boolean },
  ): Promise<void> {
    if (assignment.employeeId) {
      const employee = await this.access.getEmployeeOrFail(assignment.employeeId);
      await this.access.requireCanView(actor, employee);
      return;
    }
    if (assignment.detachedFromEmployeeId) {
      const previous = await this.access.getEmployeeOrFail(
        assignment.detachedFromEmployeeId,
      );
      await this.access.requireCanView(actor, previous);
      return;
    }
    if (options.allowUnattached) return;
    throw new ConflictException('Assignment has no attached employee');
  }

  private async latestSubmissionByResponseIds(
    responseIds: string[],
  ): Promise<
    Map<string, ReturnType<typeof toSubmissionSummaryDto>>
  > {
    const unique = [...new Set(responseIds)];
    const map = new Map<string, ReturnType<typeof toSubmissionSummaryDto>>();
    if (unique.length === 0) return map;

    const rows = await this.submissions
      .createQueryBuilder('s')
      .where('s.response_id IN (:...ids)', { ids: unique })
      .orderBy('s.response_id', 'ASC')
      .addOrderBy('s.submission_number', 'DESC')
      .getMany();

    for (const row of rows) {
      if (!map.has(row.responseId)) {
        map.set(row.responseId, toSubmissionSummaryDto(row));
      }
    }
    return map;
  }

  async requireCanViewAssignment(
    actor: User,
    assignment: QuestionnaireAssignment,
    authz: AuthorizationContext,
  ): Promise<void> {
    if (assignment.employeeId) {
      const employee = await this.access.getEmployeeOrFail(assignment.employeeId);
      await this.access.requireCanView(actor, employee);
      const isOwner = this.access.isOwner(actor, employee);
      if (!isOwner && !canViewQuestionnaires(authz)) {
        throw new ForbiddenException('Cannot view questionnaires');
      }
      return;
    }

    if (assignment.detachedFromEmployeeId) {
      const previous = await this.access.getEmployeeOrFail(
        assignment.detachedFromEmployeeId,
      );
      await this.access.requireCanView(actor, previous);
      if (!canViewQuestionnaires(authz)) {
        throw new ForbiddenException('Cannot view questionnaires');
      }
      return;
    }

    if (!canReadUnattachedNewPool(authz)) {
      throw new ForbiddenException('Cannot view questionnaires');
    }
  }

  private async toListItem(
    actor: User,
    authz: AuthorizationContext,
    row: QuestionnaireAssignment,
    employee: Employee,
  ) {
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
        latestSubmission = toSubmissionSummaryDto(sub);
      }
    }

    const schema = row.templateVersion.schemaJson as {
      steps: Array<{ fields: Array<{ key: string }> }>;
    };

    const lifecycle = computeListLifecycleCapabilities({
      authz,
      actor,
      status: row.status,
      employeeId: row.employeeId,
      detachedFromEmployeeId: row.detachedFromEmployeeId,
      employee,
      access: this.access,
      hasLatestSubmission: latestSubmission != null,
    });

    const canViewAssignmentComment = canReadAssignmentComment(authz);

    return {
      id: row.id,
      code: row.code,
      employeeId: row.employeeId,
      templateCode: row.templateVersion.template.code,
      templateTitle: assignmentDisplayTitle(row),
      templateType: row.templateVersion.template.type,
      version: row.templateVersion.version,
      status: row.status,
      dueAt: row.dueAt?.toISOString() ?? null,
      startedAt: row.startedAt?.toISOString() ?? null,
      submittedAt: row.submittedAt?.toISOString() ?? null,
      reviewedAt: row.reviewedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      completionPercent: completionPercent(draft?.answersJson, schema),
      ...(canViewAssignmentComment ? { comment: row.comment ?? null } : {}),
      latestSubmission,
      capabilities: {
        canOpen: lifecycle.canOpen,
        canAssign: lifecycle.canAssign,
        canCancel: lifecycle.canCancel,
        canClose: lifecycle.canClose,
        canDelete: lifecycle.canDelete,
        canStartFill: lifecycle.canStartFill,
      },
    };
  }

  /**
   * After attach/create capture: seed draft org refs from frozen context so
   * submit (draft ≡ context) works before the user touches org fields.
   */
  private async seedCompanyWorkAnswersFromContext(
    assignmentId: string,
    contextJson: Record<string, unknown>,
    manager: EntityManager,
  ): Promise<void> {
    const parsed = parseQuestionnaireContext(contextJson);
    if (!parsed.ok) return;
    const response = await manager.getRepository(QuestionnaireResponse).findOne({
      where: { assignmentId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!response) return;
    const answers = { ...(response.answersJson ?? {}) };
    applyCanonicalOrganizationAnswers(answers, parsed.context.positionCatalog);
    response.answersJson = answers;
    await manager.getRepository(QuestionnaireResponse).save(response);
  }
}

/** Display title for an assignment: custom title or template title. */
export function assignmentDisplayTitle(assignment: {
  title?: string | null;
  templateVersion?: { template?: { title?: string | null } | null } | null;
}): string {
  const custom = assignment.title?.trim();
  if (custom) return custom;
  return assignment.templateVersion?.template?.title?.trim() || 'Анкета';
}
