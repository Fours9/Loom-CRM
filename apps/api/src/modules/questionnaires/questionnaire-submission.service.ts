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
    if (!this.access.isOwner(actor, employee)) {
      throw new ForbiddenException('Only the employee may submit');
    }
    if (
      !this.permissions.has(actor.role, Permission.QuestionnairesCompleteSelf)
    ) {
      throw new ForbiddenException('Cannot submit questionnaire');
    }

    const allowed = new Set(['assigned', 'in_progress', 'changes_requested']);
    if (!allowed.has(assignment.status)) {
      throw new BadRequestException(
        `Cannot submit from status ${assignment.status}`,
      );
    }

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

      assignment.status = 'submitted';
      assignment.submittedAt = now;
      if (!assignment.startedAt) assignment.startedAt = now;
      await assignmentRepo.save(assignment);

      return created;
    });

    await this.proposals.generateFromSubmission(actor, submission.id);

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

    if (assignment.status !== 'submitted' && assignment.status !== 'reviewed') {
      throw new BadRequestException(
        `Cannot request changes from status ${assignment.status}`,
      );
    }

    const response = await this.responses.findOne({
      where: { assignmentId },
    });
    if (!response) throw new NotFoundException('Response not found');

    const latest = await this.submissions.findOne({
      where: { responseId: response.id },
      order: { submissionNumber: 'DESC' },
    });
    if (!latest) throw new NotFoundException('No submission to review');

    const now = new Date();
    latest.reviewStatus = 'changes_requested';
    latest.reviewedByUserId = actor.id;
    latest.reviewedAt = now;
    latest.reviewComment = input.reviewComment?.trim() || null;
    await this.submissions.save(latest);

    assignment.status = 'changes_requested';
    await this.assignments.save(assignment);

    return {
      id: latest.id,
      submissionNumber: latest.submissionNumber,
      submittedAt: latest.submittedAt.toISOString(),
      reviewStatus: latest.reviewStatus,
      reviewedAt: latest.reviewedAt?.toISOString() ?? null,
      reviewComment: latest.reviewComment,
    };
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

    const now = new Date();
    submission.reviewStatus = input.reviewStatus;
    submission.reviewedByUserId = actor.id;
    submission.reviewedAt = now;
    submission.reviewComment = input.reviewComment?.trim() || null;
    await this.submissions.save(submission);

    if (input.reviewStatus === 'approved') {
      assignment.status = 'reviewed';
      assignment.reviewedAt = now;
    } else {
      assignment.status = 'changes_requested';
    }
    await this.assignments.save(assignment);

    return {
      id: submission.id,
      submissionNumber: submission.submissionNumber,
      submittedAt: submission.submittedAt.toISOString(),
      reviewStatus: submission.reviewStatus,
      reviewedAt: submission.reviewedAt?.toISOString() ?? null,
      reviewComment: submission.reviewComment,
    };
  }
}
