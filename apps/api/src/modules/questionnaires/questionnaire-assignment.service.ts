import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../platform/identity/user.entity';
import { UserStatus } from '../../platform/identity/user.enums';
import { UsersService } from '../../platform/identity/users.service';
import { Permission } from '../../platform/permissions/permission.names';
import { PermissionService } from '../../platform/permissions/permission.service';
import { EmployeeAccessService } from '../../organization/access/employee-access.service';
import { QuestionnaireAssignment } from './questionnaire-assignment.entity';
import { QuestionnaireResponse } from './questionnaire-response.entity';
import { QuestionnaireSubmission } from './questionnaire-submission.entity';
import { QuestionnaireTemplate } from './questionnaire-template.entity';
import { QuestionnaireTemplateVersion } from './questionnaire-template-version.entity';
import { QuestionnaireResponseService } from './questionnaire-response.service';
import {
  completionPercent,
  EMPLOYEE_360_TEMPLATE_CODE,
} from './seed/employee-360-v1.schema';

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
    private readonly access: EmployeeAccessService,
    private readonly users: UsersService,
    private readonly permissions: PermissionService,
    private readonly responseService: QuestionnaireResponseService,
  ) {}

  async create(
    actor: User,
    input: { employeeId: string; templateCode?: string; dueAt?: string | null },
  ) {
    if (!this.permissions.has(actor.role, Permission.QuestionnairesAssign)) {
      throw new ForbiddenException('Cannot assign questionnaire');
    }

    const employee = await this.access.getEmployeeOrFail(input.employeeId);
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

    const code = input.templateCode?.trim() || EMPLOYEE_360_TEMPLATE_CODE;
    const template = await this.templates.findOne({ where: { code } });
    if (!template || template.status !== 'published') {
      throw new NotFoundException(`Questionnaire template not found: ${code}`);
    }

    const version = await this.versions.findOne({
      where: { templateId: template.id },
      order: { version: 'DESC' },
    });
    if (!version || !version.publishedAt) {
      throw new NotFoundException('No published questionnaire template version');
    }

    const assignment = await this.assignments.save(
      this.assignments.create({
        templateVersionId: version.id,
        employeeId: employee.id,
        assignedByUserId: actor.id,
        status: 'assigned',
        dueAt: input.dueAt ? new Date(input.dueAt) : null,
      }),
    );

    await this.responseService.ensureResponse(assignment.id);
    return this.getDetail(actor, assignment.id);
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
      where: { employeeId },
      relations: { templateVersion: { template: true } },
      order: { createdAt: 'DESC' },
    });

    const items = await Promise.all(
      rows.map(async (row) => this.toListItem(actor, row, employee)),
    );

    return {
      items,
      capabilities: { canAssign },
    };
  }

  async getDetail(actor: User, assignmentId: string) {
    const assignment = await this.loadAssignmentOrFail(assignmentId);
    const employee = await this.access.getEmployeeOrFail(assignment.employeeId);
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

    const isOwner = this.access.isOwner(actor, employee);
    const canCompleteSelf = this.permissions.has(
      actor.role,
      Permission.QuestionnairesCompleteSelf,
    );
    const canReview = this.permissions.has(
      actor.role,
      Permission.QuestionnairesReview,
    );
    const editableStatuses = new Set(['assigned', 'in_progress', 'changes_requested']);
    const canEditDraft =
      isOwner && canCompleteSelf && editableStatuses.has(assignment.status);
    const canSubmit = canEditDraft;
    const canRequestChanges =
      canReview &&
      (assignment.status === 'submitted' || assignment.status === 'reviewed');

    let profileMirror: Record<string, unknown> | null = null;
    if (isOwner || this.access.isAdmin(actor)) {
      profileMirror = {
        lastName: employee.lastName,
        firstName: employee.firstName,
        middleName: employee.middleName,
        preferredName: employee.preferredName,
        birthDate: employee.birthDate,
        city: employee.city,
        preferredLanguage: employee.preferredLanguage,
        personalPhoneNumber: employee.personalPhoneNumber,
        personalEmail: employee.personalEmail,
        personalTelegram: employee.personalTelegram,
      };
    }

    return {
      id: assignment.id,
      employeeId: assignment.employeeId,
      templateCode: assignment.templateVersion.template.code,
      templateTitle: assignment.templateVersion.template.title,
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
      capabilities: {
        canEditDraft,
        canSubmit,
        canRequestChanges,
        canReview:
          canReview &&
          (assignment.status === 'submitted' ||
            assignment.status === 'changes_requested' ||
            assignment.status === 'reviewed'),
      },
    };
  }

  async loadAssignmentOrFail(id: string): Promise<QuestionnaireAssignment> {
    const assignment = await this.assignments.findOne({
      where: { id },
      relations: { templateVersion: { template: true } },
    });
    if (!assignment) throw new NotFoundException('Assignment not found');
    return assignment;
  }

  private canAssign(actor: User): boolean {
    return this.permissions.has(actor.role, Permission.QuestionnairesAssign);
  }

  private async requireCanViewAssignment(
    actor: User,
    employee: Awaited<ReturnType<EmployeeAccessService['getEmployeeOrFail']>>,
  ): Promise<void> {
    await this.access.requireCanView(actor, employee);
    const isOwner = this.access.isOwner(actor, employee);
    if (
      !isOwner &&
      !this.permissions.has(actor.role, Permission.QuestionnairesView)
    ) {
      throw new ForbiddenException('Cannot view questionnaires');
    }
  }

  private async toListItem(
    actor: User,
    row: QuestionnaireAssignment,
    employee: Awaited<ReturnType<EmployeeAccessService['getEmployeeOrFail']>>,
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

    return {
      id: row.id,
      employeeId: row.employeeId,
      templateCode: row.templateVersion.template.code,
      templateTitle: row.templateVersion.template.title,
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
        canOpen: true,
        canAssign: this.canAssign(actor),
      },
    };
  }
}
