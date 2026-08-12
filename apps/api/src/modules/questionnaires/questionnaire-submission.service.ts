import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { User } from '../../platform/identity/user.entity';
import { UserRole, UserStatus } from '../../platform/identity/user.enums';
import { Permission } from '../../platform/permissions/permission.names';
import { PermissionService } from '../../platform/permissions/permission.service';
import { EmployeeAccessService } from '../../organization/access/employee-access.service';
import type { Employee } from '../../organization/employees/employee.entity';
import { NotificationsService } from '../../platform/notifications/notifications.service';
import { QuestionnaireAssignment } from './questionnaire-assignment.entity';
import { QuestionnaireResponse } from './questionnaire-response.entity';
import { QuestionnaireSubmission } from './questionnaire-submission.entity';
import { QuestionnaireProposalService } from './questionnaire-proposal.service';
import { QuestionnaireResponseService } from './questionnaire-response.service';
import { projectVisibleQuestionnaireAnswers } from '@loom/questionnaire-schema';
import type { QuestionnaireSchemaJson } from '@loom/contracts-questionnaires';
import {
  applyReopenTransition,
  toSubmissionSummaryDto,
} from './reopen/questionnaire-reopen-transition';
import {
  collectChangesRequestedRecipientIds,
  hasActiveReviewerRequest,
} from './reopen/questionnaire-active-change-request';
import {
  computeDetailCapabilities,
  requireActorAccessAssignmentType,
  requireCanSubmit,
} from './assignments/questionnaire-assignment-access';
import { isOwnerEditableStatus } from './assignments/questionnaire-assignment-transitions';

@Injectable()
export class QuestionnaireSubmissionService {
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
    private readonly permissions: PermissionService,
    private readonly responseService: QuestionnaireResponseService,
    private readonly proposals: QuestionnaireProposalService,
    private readonly notifications: NotificationsService,
    private readonly dataSource: DataSource,
  ) {}

  async submit(actor: User, assignmentId: string) {
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
    requireActorAccessAssignmentType({
      actor,
      employee,
      templateType: assignment.templateVersion.template.type,
      permissions: this.permissions,
      access: this.access,
    });

    const caps = computeDetailCapabilities({
      actor,
      employee,
      status: assignment.status,
      permissions: this.permissions,
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
    const snapshotJson = projectVisibleQuestionnaireAnswers(
      schema,
      response.answersJson ?? {},
    );

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
        submittedByUserId: actor.id,
        submittedAt: now,
        reviewStatus: 'pending',
        changeRequestResolution: null,
        changeRequestResolvedByUserId: null,
        changeRequestResolvedAt: null,
      }),
    );

    assignment.status = 'submitted';
    assignment.submittedAt = now;
    assignment.reviewedAt = null;
    if (!assignment.startedAt) assignment.startedAt = now;
    await manager.getRepository(QuestionnaireAssignment).save(assignment);

    await this.proposals.generateFromSubmission(manager, actor, created.id);

    return created;
  }

  async requestChanges(
    actor: User,
    assignmentId: string,
    input: { reviewComment: string },
  ) {
    if (!this.permissions.has(actor.role, Permission.QuestionnairesReview)) {
      throw new ForbiddenException('Cannot request changes');
    }

    const comment = input.reviewComment?.trim() ?? '';
    if (!comment) {
      throw new BadRequestException('Review comment is required');
    }

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
    requireActorAccessAssignmentType({
      actor,
      employee,
      templateType: assignment.templateVersion.template.type,
      permissions: this.permissions,
      access: this.access,
    });

    const caps = computeDetailCapabilities({
      actor,
      employee,
      status: assignment.status,
      permissions: this.permissions,
      access: this.access,
    });
    if (!caps.canRequestChanges) {
      throw new ForbiddenException('Cannot request changes');
    }

    const templateTitle =
      assignment.templateVersion?.template?.title ?? 'Анкета';

    const { submission } = await this.dataSource.transaction(async (manager) => {
      const locked = await manager
        .getRepository(QuestionnaireAssignment)
        .findOne({
          where: { id: assignmentId },
          lock: { mode: 'pessimistic_write' },
        });
      if (!locked) throw new NotFoundException('Assignment not found');

      const result = await applyReopenTransition(manager, locked, {
        kind: 'reviewer_request_changes',
        actorUserId: actor.id,
        reviewComment: comment,
      });

      await this.notifyChangesRequested(
        manager,
        actor,
        result.assignment,
        employee,
        templateTitle,
        comment,
      );

      return result;
    });

    return toSubmissionSummaryDto(submission);
  }

  /**
   * Owner reopens a submitted/reviewed assignment for further edits.
   * Does not mutate latest submission review metadata.
   */
  async reopenSelf(actor: User, assignmentId: string) {
    const assignment = await this.assignments.findOne({
      where: { id: assignmentId },
      relations: { templateVersion: { template: true } },
    });
    if (!assignment) throw new NotFoundException('Assignment not found');
    if (!assignment.employeeId) {
      throw new BadRequestException('Assignment has no attached employee');
    }

    const employee = await this.access.getEmployeeOrFail(assignment.employeeId);
    requireActorAccessAssignmentType({
      actor,
      employee,
      templateType: assignment.templateVersion.template.type,
      permissions: this.permissions,
      access: this.access,
    });
    const caps = computeDetailCapabilities({
      actor,
      employee,
      status: assignment.status,
      permissions: this.permissions,
      access: this.access,
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
    requireActorAccessAssignmentType({
      actor,
      employee,
      templateType: assignment.templateVersion.template.type,
      permissions: this.permissions,
      access: this.access,
    });

    const caps = computeDetailCapabilities({
      actor,
      employee,
      status: assignment.status,
      permissions: this.permissions,
      access: this.access,
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
    requireActorAccessAssignmentType({
      actor,
      employee,
      templateType: assignment.templateVersion.template.type,
      permissions: this.permissions,
      access: this.access,
    });

    const templateTitle =
      assignment.templateVersion?.template?.title ?? 'Анкета';

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
        actor,
        employee,
        status: lockedAssignment.status,
        permissions: this.permissions,
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

        lockedAssignment.status = 'submitted';
        await manager
          .getRepository(QuestionnaireAssignment)
          .save(lockedAssignment);

        await this.notifyResolveOutcome(
          manager,
          actor,
          reviewedByUserId,
          assignmentId,
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
    if (!this.permissions.has(actor.role, Permission.QuestionnairesReview)) {
      throw new ForbiddenException('Cannot review submission');
    }

    const submission = await this.submissions.findOne({
      where: { id: submissionId },
      relations: { response: true },
    });
    if (!submission) throw new NotFoundException('Submission not found');

    const assignment = await this.assignments.findOne({
      where: { id: submission.response.assignmentId },
      relations: { templateVersion: { template: true } },
    });
    if (!assignment) throw new NotFoundException('Assignment not found');
    if (!assignment.employeeId) {
      throw new BadRequestException('Assignment has no attached employee');
    }

    const employee = await this.access.getEmployeeOrFail(assignment.employeeId);
    await this.access.requireCanView(actor, employee);

    if (input.reviewStatus === 'changes_requested') {
      const comment = input.reviewComment?.trim() ?? '';
      if (!comment) {
        throw new BadRequestException('Review comment is required');
      }

      const latest = await this.submissions.findOne({
        where: { responseId: submission.response.id },
        order: { submissionNumber: 'DESC' },
      });
      if (!latest || latest.id !== submission.id) {
        throw new ConflictException(
          'Запросити зміни можна лише до останньої версії анкети',
        );
      }

      const caps = computeDetailCapabilities({
        actor,
        employee,
        status: assignment.status,
        permissions: this.permissions,
        access: this.access,
      });
      if (!caps.canRequestChanges) {
        throw new ForbiddenException('Cannot request changes');
      }

      const templateTitle =
        assignment.templateVersion?.template?.title ?? 'Анкета';

      const { submission: updated } = await this.dataSource.transaction(
        async (manager) => {
          const locked = await manager
            .getRepository(QuestionnaireAssignment)
            .findOne({
              where: { id: assignment.id },
              lock: { mode: 'pessimistic_write' },
            });
          if (!locked) throw new NotFoundException('Assignment not found');

          const result = await applyReopenTransition(manager, locked, {
            kind: 'reviewer_request_changes',
            actorUserId: actor.id,
            reviewComment: comment,
          });

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

    const now = new Date();
    submission.reviewStatus = 'approved';
    submission.reviewedByUserId = actor.id;
    submission.reviewedAt = now;
    submission.reviewComment = input.reviewComment?.trim() || null;
    await this.submissions.save(submission);

    assignment.status = 'reviewed';
    assignment.reviewedAt = now;
    await this.assignments.save(assignment);

    return toSubmissionSummaryDto(submission);
  }

  private async notifyChangesRequested(
    manager: EntityManager,
    actor: User,
    assignment: QuestionnaireAssignment,
    employee: Employee,
    templateTitle: string,
    comment: string,
  ): Promise<void> {
    const assignedBy = await manager.getRepository(User).findOne({
      where: {
        id: assignment.assignedByUserId,
        status: UserStatus.Active,
      },
    });

    let assignedByCanEditDraft = false;
    if (assignedBy) {
      const caps = computeDetailCapabilities({
        actor: assignedBy,
        employee,
        status: assignment.status,
        permissions: this.permissions,
        access: this.access,
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
    templateTitle: string,
    outcome: 'completed' | 'declined',
  ): Promise<void> {
    if (reviewedByUserId === actor.id) return;

    const recipient = await manager.getRepository(User).findOne({
      where: { id: reviewedByUserId, status: UserStatus.Active },
    });
    if (!recipient) return;

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
