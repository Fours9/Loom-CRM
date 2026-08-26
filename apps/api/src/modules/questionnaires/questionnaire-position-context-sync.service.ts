import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { type PositionSkillContext, type QuestionnaireContextV2 } from '@loom/contracts-questionnaires';
import {
  InvalidPositionSkillsMatrix,
  parsePositionSkillsMatrixStrict,
  pruneUnratedMatrixRatings,
  type PositionSkillsMatrixAnswer,
} from '@loom/questionnaire-schema';
import { User } from '../../platform/identity/user.entity';
import { PermissionService } from '../../platform/permissions/permission.service';
import { EmployeeAccessService } from '../../organization/access/employee-access.service';
import { PositionCatalogFacade } from '../../organization/position-catalog/position-catalog.facade';
import { Skill } from '../../organization/skills/skill.entity';
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
import {
  resolveValidatedExtras,
  staleRatingCodes,
  validateDesiredExtraSkillCodes,
} from './questionnaire-position-context-sync.policy';
import { resolveQuestionnaireOrganizationSelection } from './questionnaire-organization-selection';

const MATRIX_KEY = 'skills.matrix';

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

      if (lockedResponse.revision !== input.expectedDraftRevision) {
        throw new ConflictException({
          message: 'Draft revision conflict',
          currentRevision: lockedResponse.revision,
        });
      }

      const answers = {
        ...(lockedResponse.answersJson ?? {}),
      } as Record<string, unknown>;

      const org = await resolveQuestionnaireOrganizationSelection(
        answers,
        manager,
      );

      const baseSnapshot = await this.positionCatalog.buildSnapshotForPosition(
        lockedAssignment.employeeId,
        org.positionId,
        manager,
      );
      const newRequirementCodes = new Set(
        baseSnapshot.positionCatalog.skills.map((s) => s.code),
      );

      const extrasResolved = resolveValidatedExtras({
        desiredExtraSkillCodes: desiredParsed.codes,
        newRequirementCodes,
      });
      if (!extrasResolved.ok) {
        throw new BadRequestException(extrasResolved.error);
      }

      const skillsByCode = await loadSkillsByCode(
        manager.getRepository(Skill),
        extrasResolved.extraCodes,
      );

      const extraSkills: PositionSkillContext[] = [];
      for (const code of extrasResolved.extraCodes) {
        const skill = skillsByCode.get(code);
        if (!skill || !skill.isActive) {
          throw new BadRequestException(
            `Unknown or inactive skill code "${code}"`,
          );
        }
        extraSkills.push(skillEntityToExtraContext(skill));
      }

      const contextSkills = [
        ...baseSnapshot.positionCatalog.skills,
        ...extraSkills,
      ];
      const contextSkillCodes = new Set(contextSkills.map((s) => s.code));

      let matrix = readMatrix(answers);
      const draftRatingCodes = matrix.ratings
        .map((r) => r.skillCode)
        .filter(Boolean);
      const stale = staleRatingCodes(draftRatingCodes, contextSkillCodes);
      if (stale.size > 0) {
        matrix = {
          ...matrix,
          ratings: matrix.ratings.filter((r) => !stale.has(r.skillCode)),
        };
      }
      matrix = pruneUnratedMatrixRatings(matrix);
      answers[MATRIX_KEY] = matrix;

      const contextV2: QuestionnaireContextV2 = {
        version: 2,
        positionCatalog: {
          ...baseSnapshot.positionCatalog,
          positionId: org.positionId,
          positionName: org.positionName,
          departmentId: org.departmentId,
          departmentName: org.departmentName,
          directionId: org.directionId,
          directionName: org.directionName,
          skills: contextSkills,
        },
      };

      lockedAssignment.contextJson = contextV2 as unknown as Record<
        string,
        unknown
      >;
      lockedResponse.answersJson = answers;
      lockedResponse.revision = lockedResponse.revision + 1;

      await manager.getRepository(QuestionnaireAssignment).save(lockedAssignment);
      await manager.getRepository(QuestionnaireResponse).save(lockedResponse);
    });

    return this.assignmentService.getDetail(actor, assignmentId);
  }
}

function readMatrix(
  answers: Record<string, unknown>,
): PositionSkillsMatrixAnswer {
  try {
    return parsePositionSkillsMatrixStrict(answers[MATRIX_KEY]);
  } catch (err) {
    if (err instanceof InvalidPositionSkillsMatrix) {
      throw new BadRequestException(err.message);
    }
    throw err;
  }
}

async function loadSkillsByCode(
  repo: Repository<Skill>,
  codes: string[],
): Promise<Map<string, Skill>> {
  const unique = [...new Set(codes.filter(Boolean))];
  if (!unique.length) return new Map();
  const rows = await repo.find({
    where: { code: In(unique) },
    relations: { group: true },
  });
  return new Map(rows.map((s) => [s.code, s]));
}

function skillEntityToExtraContext(skill: Skill): PositionSkillContext {
  return {
    skillId: skill.id,
    code: skill.code,
    labelUa: skill.name,
    group: skill.group?.code ?? '',
    targetLevel: null,
    required: false,
    weight: null,
    scaleKind: skill.scaleKind,
    scaleMin: skill.scaleMin,
    scaleMax: skill.scaleMax,
    source: 'questionnaire_extra',
  };
}
