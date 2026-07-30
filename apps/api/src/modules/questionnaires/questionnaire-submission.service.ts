import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { User } from '../../platform/identity/user.entity';
import { Permission } from '../../platform/permissions/permission.names';
import { PermissionService } from '../../platform/permissions/permission.service';
import { EmployeeAccessService } from '../../organization/access/employee-access.service';
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
import { supersedePendingForSubmission } from './proposals/questionnaire-proposal-lifecycle';
import {
  canCompleteOnBehalf,
  computeDetailCapabilities,
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
    private readonly access: EmployeeAccessService,
    private readonly permissions: PermissionService,
    private readonly responseService: QuestionnaireResponseService,
    private readonly proposals: QuestionnaireProposalService,
    private readonly dataSource: DataSource,
  ) {}

  async submit(actor: User, assignmentId: string) {
    const assignment = await this.assignments.findOne({
      where: { id: assignmentId },
      relations: { templateVersion: { template: true } },
    });
    if (!assignment) throw new NotFoundException('Assignment not found');

    const employee = await this.access.getEmployeeOrFail(assignment.employeeId);
    await this.access.requireCanView(actor, employee);

    const caps = computeDetailCapabilities({
      actor,
      employee,
      status: assignment.status,
      permissions: this.permissions,
      access: this.access,
    });
    requireCanSubmit(caps);

    if (
      !isOwnerEditableStatus(assignment.status) &&
      assignment.status !== 'cancelled'
    ) {
      throw new BadRequestException(
        `Cannot submit from status ${assignment.status}`,
      );
    }

    const preserveCancelled =
      assignment.status === 'cancelled' &&
      canCompleteOnBehalf(this.permissions, actor);

    const response = await this.responseService.ensureResponse(assignmentId);
    const schema = assignment.templateVersion
      .schemaJson as unknown as QuestionnaireSchemaJson;
    const snapshotJson = projectVisibleQuestionnaireAnswers(
      schema,
      response.answersJson ?? {},
    );
    const latest = await this.submissions.findOne({
      where: { responseId: response.id },
      order: { submissionNumber: 'DESC' },
    });
    const nextNumber = (latest?.submissionNumber ?? 0) + 1;
    const now = new Date();

    const submission = await this.dataSource.transaction(async (manager) => {
      const submissionRepo = manager.getRepository(QuestionnaireSubmission);
      const assignmentRepo = manager.getRepository(QuestionnaireAssignment);

      const created = await submissionRepo.save(
        submissionRepo.create({
          responseId: response.id,
          submissionNumber: nextNumber,
          snapshotJson,
          submittedByUserId: actor.id,
          submittedAt: now,
          reviewStatus: 'pending',
        }),
      );

      assignment.status = preserveCancelled ? 'cancelled' : 'submitted';
      assignment.submittedAt = now;
      assignment.reviewedAt = null;
      if (!assignment.startedAt) assignment.startedAt = now;
      await assignmentRepo.save(assignment);

      await this.proposals.generateFromSubmission(manager, actor, created.id);

      return created;
    });

    return {
      id: submission.id,
      submissionNumber: submission.submissionNumber,
      submittedAt: submission.submittedAt.toISOString(),
      reviewStatus: submission.reviewStatus,
      reviewedAt: null,
      reviewComment: null,
    };
  }

  async requestChanges(
    actor: User,
    assignmentId: string,
    input: { reviewComment?: string | null },
  ) {
    if (!this.permissions.has(actor.role, Permission.QuestionnairesReview)) {
      throw new ForbiddenException('Cannot request changes');
    }

    const assignment = await this.assignments.findOne({
      where: { id: assignmentId },
    });
    if (!assignment) throw new NotFoundException('Assignment not found');

    const employee = await this.access.getEmployeeOrFail(assignment.employeeId);
    await this.access.requireCanView(actor, employee);

    const { submission } = await this.dataSource.transaction(async (manager) =>
      applyReopenTransition(manager, assignment, {
        kind: 'reviewer_request_changes',
        actorUserId: actor.id,
        reviewComment: input.reviewComment ?? null,
      }),
    );

    return toSubmissionSummaryDto(submission);
  }

  /**
   * Owner reopens a submitted/reviewed assignment for further edits.
   * Does not mutate latest submission review metadata.
   */
  async reopenSelf(actor: User, assignmentId: string) {
    const assignment = await this.assignments.findOne({
      where: { id: assignmentId },
    });
    if (!assignment) throw new NotFoundException('Assignment not found');

    const employee = await this.access.getEmployeeOrFail(assignment.employeeId);
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

    const { submission } = await this.dataSource.transaction(async (manager) =>
      applyReopenTransition(manager, assignment, {
        kind: 'owner_reopen',
        actorUserId: actor.id,
      }),
    );

    return toSubmissionSummaryDto(submission);
  }

  /**
   * Admin (CompleteAny) starts a shared revision — also opens owner edit.
   */
  async startRevision(actor: User, assignmentId: string) {
    const assignment = await this.assignments.findOne({
      where: { id: assignmentId },
    });
    if (!assignment) throw new NotFoundException('Assignment not found');

    const employee = await this.access.getEmployeeOrFail(assignment.employeeId);
    await this.access.requireCanView(actor, employee);

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

    const { submission } = await this.dataSource.transaction(async (manager) =>
      applyReopenTransition(manager, assignment, {
        kind: 'admin_start_revision',
        actorUserId: actor.id,
      }),
    );

    return toSubmissionSummaryDto(submission);
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
    });
    if (!assignment) throw new NotFoundException('Assignment not found');

    const employee = await this.access.getEmployeeOrFail(assignment.employeeId);
    await this.access.requireCanView(actor, employee);

    if (input.reviewStatus === 'changes_requested') {
      // Prefer shared transition when the reviewed row is the latest submission.
      const response = submission.response;
      const latest = await this.submissions.findOne({
        where: { responseId: response.id },
        order: { submissionNumber: 'DESC' },
      });
      if (latest && latest.id === submission.id) {
        const { submission: updated } = await this.dataSource.transaction(
          async (manager) =>
            applyReopenTransition(manager, assignment, {
              kind: 'reviewer_request_changes',
              actorUserId: actor.id,
              reviewComment: input.reviewComment ?? null,
            }),
        );
        return toSubmissionSummaryDto(updated);
      }

      // Older submission reviewed: update that row + supersede its pending.
      const now = new Date();
      await this.dataSource.transaction(async (manager) => {
        const subRepo = manager.getRepository(QuestionnaireSubmission);
        const assignRepo = manager.getRepository(QuestionnaireAssignment);
        submission.reviewStatus = 'changes_requested';
        submission.reviewedByUserId = actor.id;
        submission.reviewedAt = now;
        submission.reviewComment = input.reviewComment?.trim() || null;
        await subRepo.save(submission);
        assignment.status = 'changes_requested';
        await assignRepo.save(assignment);
        await supersedePendingForSubmission(manager, submission.id, now);
      });
      return toSubmissionSummaryDto(submission);
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
}
