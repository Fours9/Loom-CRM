import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { User } from '../../platform/identity/user.entity';
import { UserRole, UserStatus } from '../../platform/identity/user.enums';
import { AuthorizationContextService } from '../../platform/access-control/authorization-context.service';
import { hasQuestionnaireTemplate } from '../../platform/access-control/authorization-context';
import { EmployeeAccessService } from '../../organization/access/employee-access.service';
import type { Employee } from '../../organization/employees/employee.entity';
import { NotificationsService } from '../../platform/notifications/notifications.service';
import { QuestionnaireAssignment } from './questionnaire-assignment.entity';
import { QuestionnaireResponse } from './questionnaire-response.entity';
import { QuestionnaireSubmission } from './questionnaire-submission.entity';
import { QuestionnaireProposalService } from './questionnaire-proposal.service';
import { QuestionnaireResponseService } from './questionnaire-response.service';
import {
  InvalidPositionSkillsMatrix,
  parsePositionSkillsMatrixStrict,
  projectVisibleQuestionnaireAnswers,
} from '@loom/questionnaire-schema';
import { InvalidEmployeeContactsBundle } from '@loom/employee-contacts';
import type {
  QuestionnaireContext,
  QuestionnaireSchemaJson,
} from '@loom/contracts-questionnaires';
import { parseQuestionnaireContext } from '@loom/contracts-questionnaires';
import { validateDraftAnswersForSubmit } from './questionnaire-answers-validation';
import { QuestionnaireContextSkillIdBackfillService } from './assignments/questionnaire-context-skill-id-backfill.service';
import {
  applyCanonicalOrganizationAnswers,
  resolveQuestionnaireOrganizationSelection,
} from './questionnaire-organization-selection';
import {
  applyReopenTransition,
  toSubmissionSummaryDto,
} from './reopen/questionnaire-reopen-transition';
import { applyReviewTransition } from './reopen/questionnaire-review-transition';
import {
  collectChangesRequestedRecipientIds,
  hasActiveReviewerRequest,
} from './reopen/questionnaire-active-change-request';
import {
  computeDetailCapabilities,
  canReviewQuestionnaires,
  requireActorAccessAssignmentTemplate,
  requireCanSubmit,
} from './assignments/questionnaire-assignment-access';
import { isOwnerEditableStatus } from './assignments/questionnaire-assignment-transitions';
import { EmployeeAboutFacade } from '../../organization/employees/employee-about.facade';

@Injectable()
export class QuestionnaireSubmissionService {
  private readonly logger = new Logger(QuestionnaireSubmissionService.name);

  constructor(
    @InjectRepository(QuestionnaireAssignment)
    private readonly assignments: Repository<QuestionnaireAssignment>,
    @InjectRepository(QuestionnaireResponse)
    private readonly responses: Repository<QuestionnaireResponse>,
    @InjectRepository(QuestionnaireSubmission)
    private readonly submissions: Repository<QuestionnaireSubmission>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly access: EmployeeAccessService,
    private readonly authorization: AuthorizationContextService,
    private readonly responseService: QuestionnaireResponseService,
    private readonly proposals: QuestionnaireProposalService,
    private readonly contextSkillIdBackfill: QuestionnaireContextSkillIdBackfillService,
    private readonly notifications: NotificationsService,
    private readonly dataSource: DataSource,
    private readonly aboutFacade: EmployeeAboutFacade,
  ) {}

  async submit(actor: User, assignmentId: string) {
    const authz = await this.authorization.resolve(actor.id);
    const assignment = await this.assignments.findOne({
      where: { id: assignmentId },
      relations: { templateVersion: { template: true } },
    });
    if (!assignment) throw new NotFoundException('Assignment not found');

    if (!assignment.employeeId) {
      throw new BadRequestException(
        'Questionnaire must be attached before submission',
      );
    }

    const employee = await this.access.getEmployeeOrFail(assignment.employeeId);
    await this.access.requireCanView(actor, employee);
    requireActorAccessAssignmentTemplate({
      authz,
      templateCode: assignment.templateVersion.template.code,
    });

    const caps = computeDetailCapabilities({
      authz,
      actor,
      employee,
      status: assignment.status,
      access: this.access,
    });
    requireCanSubmit(caps);

    if (!isOwnerEditableStatus(assignment.status)) {
      throw new BadRequestException(
        `Cannot submit from status ${assignment.status}`,
      );
    }

    const response = await this.responseService.ensureResponse(assignmentId);

    const submission = await this.dataSource.transaction(async (manager) => {
      const lockedAssignment = await manager
        .getRepository(QuestionnaireAssignment)
        .findOne({
          where: { id: assignmentId },
          lock: { mode: 'pessimistic_write' },
        });
      if (!lockedAssignment) {
        throw new NotFoundException('Assignment not found');
      }
      if (!isOwnerEditableStatus(lockedAssignment.status)) {
        throw new BadRequestException(
          `Cannot submit from status ${lockedAssignment.status}`,
        );
      }
      lockedAssignment.templateVersion = assignment.templateVersion;

      const lockedResponse = await manager
        .getRepository(QuestionnaireResponse)
        .findOne({
          where: { id: response.id },
          lock: { mode: 'pessimistic_write' },
        });
      if (!lockedResponse) throw new NotFoundException('Response not found');

      return this.submitWithinTransaction(
        manager,
        actor,
        lockedAssignment,
        lockedResponse,
      );
    });

    return toSubmissionSummaryDto(submission);
  }

  /**
   * Creates immutable snapshot + pending submission + proposals inside an open TX.
   * Caller must hold locks on assignment and response as needed.
   */
  async submitWithinTransaction(
    manager: EntityManager,
    actor: User,
    assignment: QuestionnaireAssignment,
    response: QuestionnaireResponse,
  ): Promise<QuestionnaireSubmission> {
    const schema = assignment.templateVersion
      .schemaJson as unknown as QuestionnaireSchemaJson;
    const answers = response.answersJson ?? {};
    try {
      let context: QuestionnaireContext | null = null;
      let allowedSkillCodes: readonly string[] | undefined;
      let levelBoundsByCode:
        | Map<string, { min: number; max: number }>
        | undefined;

      if (assignment.contextJson == null) {
        allowedSkillCodes = undefined;
      } else {
        const repaired = await this.contextSkillIdBackfill.repairContextJson(
          assignment.contextJson,
          manager,
        );
        if (repaired.changed && repaired.contextJson) {
          assignment.contextJson = repaired.contextJson;
          await manager
            .getRepository(QuestionnaireAssignment)
            .save(assignment);
        }
        const parsed = parseQuestionnaireContext(assignment.contextJson);
        if (!parsed.ok) {
          this.logger.error(
            `Invalid questionnaire context_json on submit (data integrity): ${parsed.error} assignmentId=${assignment.id}`,
          );
          throw new InternalServerErrorException(
            'Questionnaire context is corrupted',
          );
        }
        context = parsed.context;
        allowedSkillCodes = context.positionCatalog.skills.map((s) => s.code);
        if (context.version === 2) {
          levelBoundsByCode = new Map();
          for (const skill of context.positionCatalog.skills) {
            if (skill.scaleMin != null && skill.scaleMax != null) {
              levelBoundsByCode.set(skill.code, {
                min: skill.scaleMin,
                max: skill.scaleMax,
              });
            }
          }
        }
      }

      if (context) {
        const catalog = context.positionCatalog;
        const draftEmpty = [
          'company_work.direction_id',
          'company_work.department_id',
          'company_work.position_id',
        ].every((key) => {
          const v = answers[key];
          return v == null || v === '';
        });
        const contextHasOrg =
          catalog.directionId != null ||
          catalog.departmentId != null ||
          catalog.positionId != null;
        if (draftEmpty && contextHasOrg) {
          applyCanonicalOrganizationAnswers(answers, catalog);
        }
        const resolved = await resolveQuestionnaireOrganizationSelection(
          answers,
          manager,
        );
        applyCanonicalOrganizationAnswers(answers, resolved);
        response.answersJson = answers;
        if (
          resolved.directionId !== catalog.directionId ||
          resolved.departmentId !== catalog.departmentId ||
          resolved.positionId !== catalog.positionId
        ) {
          throw new BadRequestException(
            'company_work org refs must match assignment context (sync required)',
          );
        }
      }

      validateDraftAnswersForSubmit(schema, answers, {
        allowedSkillCodes,
        levelBoundsByCode,
      });
    } catch (err) {
      if (
        err instanceof InvalidEmployeeContactsBundle ||
        err instanceof InvalidPositionSkillsMatrix
      ) {
        throw new BadRequestException(err.message);
      }
      throw err;
    }
    if (!assignment.employeeId) {
      throw new BadRequestException('Assignment has no attached employee');
    }

    const snapshotJson = projectVisibleQuestionnaireAnswers(schema, answers);

    const latest = await manager.getRepository(QuestionnaireSubmission).findOne({
      where: { responseId: response.id },
      order: { submissionNumber: 'DESC' },
      lock: { mode: 'pessimistic_write' },
    });
    const nextNumber = (latest?.submissionNumber ?? 0) + 1;
    const now = new Date();

    const submissionRepo = manager.getRepository(QuestionnaireSubmission);
    const created = await submissionRepo.save(
      submissionRepo.create({
        responseId: response.id,
        submissionNumber: nextNumber,
        snapshotJson,
        contextJson: assignment.contextJson ?? null,
        submittedByUserId: actor.id,
        subjectEmployeeId: assignment.employeeId,
        submittedAt: now,
        reviewStatus: 'pending',
        changeRequestResolution: null,
        changeRequestResolvedByUserId: null,
        changeRequestResolvedAt: null,
      }),
    );

    assignment.status = 'closed';
    assignment.submittedAt = now;
    assignment.reviewedAt = null;
    if (!assignment.startedAt) assignment.startedAt = now;
    await manager.getRepository(QuestionnaireAssignment).save(assignment);

    await this.proposals.generateFromSubmission(manager, actor, created.id);

    if (assignment.employeeId) {
      await this.aboutFacade.syncFromSubmissionSnapshot(manager, {
        employeeId: assignment.employeeId,
        snapshotJson: snapshotJson as Record<string, unknown>,
        submissionId: created.id,
        actorUserId: actor.id,
        syncedAt: now,
      });
    }

    return created;
  }

  /**
   * Owner reopens a closed (post-submit) assignment for further edits.
   * Does not mutate latest submission review metadata.
   */
  async reopenSelf(actor: User, assignmentId: string) {
    const authz = await this.authorization.resolve(actor.id);
    const assignment = await this.assignments.findOne({
      where: { id: assignmentId },
      relations: { templateVersion: { template: true } },
    });
    if (!assignment) throw new NotFoundException('Assignment not found');
    if (!assignment.employeeId) {
      throw new BadRequestException('Assignment has no attached employee');
    }

    const employee = await this.access.getEmployeeOrFail(assignment.employeeId);
    requireActorAccessAssignmentTemplate({
      authz,
      templateCode: assignment.templateVersion.template.code,
    });
    const latestSubmission = await this.loadLatestSubmission(assignmentId);
    const caps = computeDetailCapabilities({
      authz,
      actor,
      employee,
      status: assignment.status,
      access: this.access,
      latestSubmission,
    });
    if (!caps.canReopenSelf) {
      throw new ForbiddenException('Cannot reopen questionnaire');
    }

    const { submission } = await this.dataSource.transaction(async (manager) => {
      const locked = await manager
        .getRepository(QuestionnaireAssignment)
        .findOne({
          where: { id: assignmentId },
          lock: { mode: 'pessimistic_write' },
        });
      if (!locked) throw new NotFoundException('Assignment not found');
      return applyReopenTransition(manager, locked, {
        kind: 'owner_reopen',
        actorUserId: actor.id,
      });
    });

    return toSubmissionSummaryDto(submission);
  }

  /**
   * Admin (CompleteAny) starts a shared revision — also opens owner edit.
   */
  async startRevision(actor: User, assignmentId: string) {
    const authz = await this.authorization.resolve(actor.id);
    const assignment = await this.assignments.findOne({
      where: { id: assignmentId },
      relations: { templateVersion: { template: true } },
    });
    if (!assignment) throw new NotFoundException('Assignment not found');
    if (!assignment.employeeId) {
      throw new BadRequestException('Assignment has no attached employee');
    }

    const employee = await this.access.getEmployeeOrFail(assignment.employeeId);
    await this.access.requireCanView(actor, employee);
    requireActorAccessAssignmentTemplate({
      authz,
      templateCode: assignment.templateVersion.template.code,
    });

    const latestSubmission = await this.loadLatestSubmission(assignmentId);
    const caps = computeDetailCapabilities({
      authz,
      actor,
      employee,
      status: assignment.status,
      access: this.access,
      latestSubmission,
    });
    if (!caps.canStartRevision) {
      throw new ForbiddenException('Cannot start questionnaire revision');
    }

    const { submission } = await this.dataSource.transaction(async (manager) => {
      const locked = await manager
        .getRepository(QuestionnaireAssignment)
        .findOne({
          where: { id: assignmentId },
          lock: { mode: 'pessimistic_write' },
        });
      if (!locked) throw new NotFoundException('Assignment not found');
      return applyReopenTransition(manager, locked, {
        kind: 'admin_start_revision',
        actorUserId: actor.id,
      });
    });

    return toSubmissionSummaryDto(submission);
  }

  async resolveChanges(
    actor: User,
    assignmentId: string,
    input:
      | { outcome: 'completed'; expectedDraftRevision: number }
      | { outcome: 'declined' },
  ) {
    const authz = await this.authorization.resolve(actor.id);
    const assignment = await this.assignments.findOne({
      where: { id: assignmentId },
      relations: { templateVersion: { template: true } },
    });
    if (!assignment) throw new NotFoundException('Assignment not found');
    if (!assignment.employeeId) {
      throw new BadRequestException('Assignment has no attached employee');
    }

    const employee = await this.access.getEmployeeOrFail(assignment.employeeId);
    await this.access.requireCanView(actor, employee);
    requireActorAccessAssignmentTemplate({
      authz,
      templateCode: assignment.templateVersion.template.code,
    });

    const templateTitle =
      assignment.title?.trim() ||
      assignment.templateVersion?.template?.title ||
      'Анкета';
    const templateCode = assignment.templateVersion.template.code;

    return this.dataSource.transaction(async (manager) => {
      const lockedAssignment = await manager
        .getRepository(QuestionnaireAssignment)
        .findOne({
          where: { id: assignmentId },
          lock: { mode: 'pessimistic_write' },
        });
      if (!lockedAssignment) {
        throw new NotFoundException('Assignment not found');
      }
      lockedAssignment.templateVersion = assignment.templateVersion;

      const response = await manager.getRepository(QuestionnaireResponse).findOne({
        where: { assignmentId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!response) throw new NotFoundException('Response not found');

      const latest = await manager.getRepository(QuestionnaireSubmission).findOne({
        where: { responseId: response.id },
        order: { submissionNumber: 'DESC' },
        lock: { mode: 'pessimistic_write' },
      });
      if (!latest) throw new NotFoundException('No submission to resolve');

      const caps = computeDetailCapabilities({
        authz,
        actor,
        employee,
        status: lockedAssignment.status,
        access: this.access,
        latestSubmission: latest,
      });
      if (!caps.canResolveChangeRequest) {
        throw new ForbiddenException('Cannot resolve change request');
      }

      if (
        !hasActiveReviewerRequest({
          assignmentStatus: lockedAssignment.status,
          latest,
        })
      ) {
        throw new ConflictException('No active change request');
      }

      const reviewedByUserId = latest.reviewedByUserId!;
      const now = new Date();

      if (input.outcome === 'declined') {
        latest.changeRequestResolution = 'declined';
        latest.changeRequestResolvedByUserId = actor.id;
        latest.changeRequestResolvedAt = now;
        await manager.getRepository(QuestionnaireSubmission).save(latest);

        lockedAssignment.status = 'closed';
        lockedAssignment.reviewedAt = null;
        await manager
          .getRepository(QuestionnaireAssignment)
          .save(lockedAssignment);

        await this.notifyResolveOutcome(
          manager,
          actor,
          reviewedByUserId,
          assignmentId,
          templateCode,
          templateTitle,
          'declined',
        );

        return toSubmissionSummaryDto(latest);
      }

      if (response.revision !== input.expectedDraftRevision) {
        throw new ConflictException({
          message: 'Draft revision conflict',
          currentRevision: response.revision,
        });
      }

      await this.submitWithinTransaction(
        manager,
        actor,
        lockedAssignment,
        response,
      );

      latest.changeRequestResolution = 'completed';
      latest.changeRequestResolvedByUserId = actor.id;
      latest.changeRequestResolvedAt = now;
      await manager.getRepository(QuestionnaireSubmission).save(latest);

      await this.notifyResolveOutcome(
        manager,
        actor,
        reviewedByUserId,
        assignmentId,
        templateCode,
        templateTitle,
        'completed',
      );

      return toSubmissionSummaryDto(latest);
    });
  }

  async review(
    actor: User,
    submissionId: string,
    input: {
      reviewStatus: 'approved' | 'changes_requested';
      reviewComment?: string | null;
    },
  ) {
    const authz = await this.authorization.resolve(actor.id);
    if (!canReviewQuestionnaires(authz)) {
      throw new ForbiddenException('Cannot review submission');
    }

    const submission = await this.submissions.findOne({
      where: { id: submissionId },
      relations: { response: true },
    });
    if (!submission) throw new NotFoundException('Submission not found');

    const assignmentId = submission.response.assignmentId;
    const assignment = await this.assignments.findOne({
      where: { id: assignmentId },
      relations: { templateVersion: { template: true } },
    });
    if (!assignment) throw new NotFoundException('Assignment not found');
    if (!assignment.employeeId) {
      throw new BadRequestException('Assignment has no attached employee');
    }

    const employee = await this.access.getEmployeeOrFail(assignment.employeeId);
    await this.access.requireCanView(actor, employee);
    requireActorAccessAssignmentTemplate({
      authz,
      templateCode: assignment.templateVersion.template.code,
    });

    const latestSubmission = await this.loadLatestSubmission(assignmentId);
    const caps = computeDetailCapabilities({
      authz,
      actor,
      employee,
      status: assignment.status,
      access: this.access,
      latestSubmission,
    });

    if (input.reviewStatus === 'changes_requested') {
      const comment = input.reviewComment?.trim() ?? '';
      if (!comment) {
        throw new BadRequestException('Review comment is required');
      }
      if (!caps.canRequestChanges) {
        throw new ForbiddenException('Cannot request changes');
      }

      const templateTitle =
        assignment.title?.trim() ||
        assignment.templateVersion?.template?.title ||
        'Анкета';

      const { submission: updated } = await this.dataSource.transaction(
        async (manager) => {
          const result = await applyReviewTransition(
            manager,
            assignmentId,
            submissionId,
            {
              kind: 'request_changes',
              actorUserId: actor.id,
              reviewComment: comment,
            },
          );

          await this.notifyChangesRequested(
            manager,
            actor,
            result.assignment,
            employee,
            templateTitle,
            comment,
          );

          return result;
        },
      );
      return toSubmissionSummaryDto(updated);
    }

    if (!caps.canReview) {
      throw new ForbiddenException('Cannot review submission');
    }

    const { submission: updated } = await this.dataSource.transaction(
      async (manager) => {
        return applyReviewTransition(manager, assignmentId, submissionId, {
          kind: 'approve',
          actorUserId: actor.id,
          reviewComment: input.reviewComment,
        });
      },
    );
    return toSubmissionSummaryDto(updated);
  }

  private async loadLatestSubmission(
    assignmentId: string,
  ): Promise<QuestionnaireSubmission | null> {
    const response = await this.responses.findOne({
      where: { assignmentId },
    });
    if (!response) return null;
    return this.submissions.findOne({
      where: { responseId: response.id },
      order: { submissionNumber: 'DESC' },
    });
  }

  private async recipientHasTemplateGrant(
    userId: string,
    templateCode: string,
    manager: EntityManager,
  ): Promise<boolean> {
    const authz = await this.authorization.resolve(userId, manager);
    return hasQuestionnaireTemplate(authz, templateCode);
  }

  private async notifyChangesRequested(
    manager: EntityManager,
    actor: User,
    assignment: QuestionnaireAssignment,
    employee: Employee,
    templateTitle: string,
    comment: string,
  ): Promise<void> {
    const templateCode =
      assignment.templateVersion?.template?.code ??
      (
        await manager.getRepository(QuestionnaireAssignment).findOne({
          where: { id: assignment.id },
          relations: { templateVersion: { template: true } },
        })
      )?.templateVersion?.template?.code;
    if (!templateCode) return;

    const assignedBy = await manager.getRepository(User).findOne({
      where: {
        id: assignment.assignedByUserId,
        status: UserStatus.Active,
      },
    });

    let assignedByCanEditDraft = false;
    if (assignedBy) {
      const assignedByAuthz = await this.authorization.resolve(
        assignedBy.id,
        manager,
      );
      const caps = computeDetailCapabilities({
        authz: assignedByAuthz,
        actor: assignedBy,
        employee,
        status: assignment.status,
        access: this.access,
        latestSubmission: {
          reviewStatus: 'changes_requested',
          reviewComment: comment,
          reviewedByUserId: actor.id,
          changeRequestResolution: null,
        },
      });
      assignedByCanEditDraft = caps.canEditDraft;
    }

    const admins = await manager.getRepository(User).find({
      where: { role: UserRole.Admin, status: UserStatus.Active },
      select: { id: true },
    });

    const recipientIds = collectChangesRequestedRecipientIds({
      actorId: actor.id,
      assignedBy: assignedBy ? { id: assignedBy.id } : null,
      assignedByCanEditDraft,
      activeAdminIds: admins.map((u) => u.id),
    });

    const body =
      comment.length > 280 ? `${comment.slice(0, 277)}…` : comment;

    for (const recipientId of recipientIds) {
      if (
        !(await this.recipientHasTemplateGrant(
          recipientId,
          templateCode,
          manager,
        ))
      ) {
        continue;
      }
      await this.notifications.create(
        {
          recipientId,
          type: 'questionnaire.changes_requested',
          title: 'Запрошено зміни до анкети',
          body: `${templateTitle}: ${body}`,
          payload: { assignmentId: assignment.id },
        },
        manager,
      );
    }
  }

  private async notifyResolveOutcome(
    manager: EntityManager,
    actor: User,
    reviewedByUserId: string,
    assignmentId: string,
    templateCode: string,
    templateTitle: string,
    outcome: 'completed' | 'declined',
  ): Promise<void> {
    if (reviewedByUserId === actor.id) return;

    const recipient = await manager.getRepository(User).findOne({
      where: { id: reviewedByUserId, status: UserStatus.Active },
    });
    if (!recipient) return;

    if (
      !(await this.recipientHasTemplateGrant(
        reviewedByUserId,
        templateCode,
        manager,
      ))
    ) {
      return;
    }

    if (outcome === 'completed') {
      await this.notifications.create(
        {
          recipientId: recipient.id,
          type: 'questionnaire.changes_completed',
          title: 'Правки до анкети виконано',
          body: templateTitle,
          payload: { assignmentId },
        },
        manager,
      );
      return;
    }

    await this.notifications.create(
      {
        recipientId: recipient.id,
        type: 'questionnaire.changes_declined',
        title: 'У правках до анкети відмовлено',
        body: templateTitle,
        payload: { assignmentId },
      },
      manager,
    );
  }
}
