import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { User } from '../../platform/identity/user.entity';
import { PermissionService } from '../../platform/permissions/permission.service';
import { EmployeeAccessService } from '../../organization/access/employee-access.service';
import { QuestionnaireAssignment } from './questionnaire-assignment.entity';
import { QuestionnaireResponse } from './questionnaire-response.entity';
import {
  computeDetailCapabilities,
  requireCanEditDraft,
} from './assignments/questionnaire-assignment-access';

@Injectable()
export class QuestionnaireResponseService {
  constructor(
    @InjectRepository(QuestionnaireResponse)
    private readonly responses: Repository<QuestionnaireResponse>,
    @InjectRepository(QuestionnaireAssignment)
    private readonly assignments: Repository<QuestionnaireAssignment>,
    private readonly access: EmployeeAccessService,
    private readonly permissions: PermissionService,
    private readonly dataSource: DataSource,
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

    const employee = assignment.employeeId
      ? await this.access.getEmployeeOrFail(assignment.employeeId)
      : null;
    if (employee) {
      await this.access.requireCanView(actor, employee);
    }

    const caps = computeDetailCapabilities({
      actor,
      employee,
      status: assignment.status,
      permissions: this.permissions,
      access: this.access,
    });
    requireCanEditDraft(caps);

    const response = await this.ensureResponse(assignmentId);

    const result = await this.dataSource
      .createQueryBuilder()
      .update(QuestionnaireResponse)
      .set({
        answersJson: input.answers ?? {},
        revision: () => '"revision" + 1',
        updatedAt: () => 'NOW()',
      })
      .where('id = :id', { id: response.id })
      .andWhere('revision = :revision', { revision: input.revision })
      .execute();

    if (!result.affected || result.affected !== 1) {
      const current = await this.responses.findOne({
        where: { id: response.id },
      });
      throw new ConflictException({
        message: 'Draft revision conflict',
        currentRevision: current?.revision ?? response.revision,
      });
    }

    const saved = await this.responses.findOne({ where: { id: response.id } });
    if (!saved) throw new NotFoundException('Response not found');

    // Do not flip cancelled → in_progress (Admin on-behalf keeps detached).
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
