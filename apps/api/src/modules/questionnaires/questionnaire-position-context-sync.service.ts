import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { User } from '../../platform/identity/user.entity';
import { PermissionService } from '../../platform/permissions/permission.service';
import { EmployeeAccessService } from '../../organization/access/employee-access.service';
import { PositionCatalogFacade } from '../../organization/position-catalog/position-catalog.facade';
import { QuestionnaireAssignment } from './questionnaire-assignment.entity';
import { QuestionnaireResponse } from './questionnaire-response.entity';
import { QuestionnaireAssignmentService } from './questionnaire-assignment.service';
import { QuestionnaireResponseService } from './questionnaire-response.service';
import {
  computeDetailCapabilities,
  requireActorAccessAssignmentType,
  requireCanEditDraft,
} from './assignments/questionnaire-assignment-access';
import { isOwnerEditableStatus } from './assignments/questionnaire-assignment-transitions';
import { validateDesiredExtraSkillCodes } from './questionnaire-position-context-sync.policy';
import { syncLocked } from './questionnaire-position-context-sync.core';

@Injectable()
export class QuestionnairePositionContextSyncService {
  constructor(
    @InjectRepository(QuestionnaireAssignment)
    private readonly assignments: Repository<QuestionnaireAssignment>,
    private readonly access: EmployeeAccessService,
    private readonly permissions: PermissionService,
    private readonly positionCatalog: PositionCatalogFacade,
    private readonly responseService: QuestionnaireResponseService,
    private readonly assignmentService: QuestionnaireAssignmentService,
    private readonly dataSource: DataSource,
  ) {}

  async sync(
    actor: User,
    assignmentId: string,
    input: {
      expectedDraftRevision: number;
      desiredExtraSkillCodes: string[];
    },
  ) {
    const desiredParsed = validateDesiredExtraSkillCodes(
      input.desiredExtraSkillCodes,
    );
    if (!desiredParsed.ok) {
      throw new BadRequestException(desiredParsed.error);
    }

    const assignment = await this.assignments.findOne({
      where: { id: assignmentId },
      relations: { templateVersion: { template: true } },
    });
    if (!assignment) throw new NotFoundException('Assignment not found');

    if (assignment.templateVersion.template.type !== 'managing') {
      throw new BadRequestException(
        'Position context sync is only available for Managing questionnaires',
      );
    }

    if (!assignment.employeeId) {
      throw new BadRequestException(
        'Questionnaire must be attached before syncing position context',
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
    requireCanEditDraft(caps);

    if (!isOwnerEditableStatus(assignment.status)) {
      throw new BadRequestException(
        `Cannot sync position context from status ${assignment.status}`,
      );
    }

    const response = await this.responseService.ensureResponse(assignmentId);

    await this.dataSource.transaction(async (manager) => {
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
          `Cannot sync position context from status ${lockedAssignment.status}`,
        );
      }
      if (!lockedAssignment.employeeId) {
        throw new BadRequestException(
          'Questionnaire must be attached before syncing position context',
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

      await syncLocked(
        manager,
        lockedAssignment,
        lockedResponse,
        {
          desiredExtraSkillCodes: desiredParsed.codes,
          expectedDraftRevision: input.expectedDraftRevision,
        },
        this.positionCatalog,
      );
    });

    return this.assignmentService.getDetail(actor, assignmentId);
  }
}
