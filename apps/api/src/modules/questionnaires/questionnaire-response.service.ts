import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../platform/identity/user.entity';
import { Permission } from '../../platform/permissions/permission.names';
import { PermissionService } from '../../platform/permissions/permission.service';
import { EmployeeAccessService } from '../../organization/access/employee-access.service';
import { QuestionnaireAssignment } from './questionnaire-assignment.entity';
import { QuestionnaireResponse } from './questionnaire-response.entity';

@Injectable()
export class QuestionnaireResponseService {
  constructor(
    @InjectRepository(QuestionnaireResponse)
    private readonly responses: Repository<QuestionnaireResponse>,
    @InjectRepository(QuestionnaireAssignment)
    private readonly assignments: Repository<QuestionnaireAssignment>,
    private readonly access: EmployeeAccessService,
    private readonly permissions: PermissionService,
  ) {}

  async ensureResponse(assignmentId: string): Promise<QuestionnaireResponse> {
    const existing = await this.responses.findOne({ where: { assignmentId } });
    if (existing) return existing;
    return this.responses.save(
      this.responses.create({
        assignmentId,
        answersJson: {},
        revision: 0,
      }),
    );
  }

  async patchDraft(
    actor: User,
    assignmentId: string,
    input: { answers: Record<string, unknown>; revision: number },
  ) {
    const assignment = await this.assignments.findOne({
      where: { id: assignmentId },
    });
    if (!assignment) throw new NotFoundException('Assignment not found');

    const employee = await this.access.getEmployeeOrFail(assignment.employeeId);
    if (!this.access.isOwner(actor, employee)) {
      throw new ForbiddenException('Only the employee may edit the draft');
    }
    if (
      !this.permissions.has(actor.role, Permission.QuestionnairesCompleteSelf)
    ) {
      throw new ForbiddenException('Cannot complete questionnaire');
    }

    const editable = new Set(['assigned', 'in_progress', 'changes_requested']);
    if (!editable.has(assignment.status)) {
      throw new ForbiddenException('Assignment is not editable');
    }

    const response = await this.ensureResponse(assignmentId);
    if (response.revision !== input.revision) {
      throw new ConflictException({
        message: 'Draft revision conflict',
        currentRevision: response.revision,
      });
    }

    response.answersJson = input.answers ?? {};
    response.revision = response.revision + 1;
    const saved = await this.responses.save(response);

    if (assignment.status === 'assigned') {
      assignment.status = 'in_progress';
      assignment.startedAt = assignment.startedAt ?? new Date();
      await this.assignments.save(assignment);
    }

    return {
      id: saved.id,
      answers: saved.answersJson,
      revision: saved.revision,
      updatedAt: saved.updatedAt.toISOString(),
    };
  }
}
