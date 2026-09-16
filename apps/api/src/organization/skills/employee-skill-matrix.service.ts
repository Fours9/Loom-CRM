import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import type {
  CreateEmployeeSkillAssessmentRequest,
  EmployeeSkillMatrixItem,
  EmployeeSkillMatrixResponse,
  UpdateEmployeeSkillAssessmentRequest,
} from '@loom/contracts-employees';
import { User } from '../../platform/identity/user.entity';
import { EmployeeAccessService } from '../access/employee-access.service';
import { CurrentEmploymentAssignmentResolver } from '../employment-catalog/current-employment-assignment.resolver';
import { PositionSkillRequirement } from '../position-requirements/position-skill-requirement.entity';
import { Employee } from '../employees/employee.entity';
import { Skill } from './skill.entity';
import { EmployeeSkillAssessment } from './employee-skill-assessment.entity';
import { EmployeeSkillAssessmentsFacade } from './employee-skill-assessments.facade';
import { classifyEmployeeSkillMatrixBuckets } from './employee-skill-matrix.classify';
import { decideSkillMatrixUpsert } from './employee-skill-matrix-upsert.policy';

@Injectable()
export class EmployeeSkillMatrixService {
  constructor(
    @InjectRepository(PositionSkillRequirement)
    private readonly requirements: Repository<PositionSkillRequirement>,
    private readonly assessmentsFacade: EmployeeSkillAssessmentsFacade,
    private readonly currentEmployment: CurrentEmploymentAssignmentResolver,
    private readonly access: EmployeeAccessService,
    private readonly dataSource: DataSource,
  ) {}

  async listMatrix(
    actor: User,
    employeeId: string,
  ): Promise<EmployeeSkillMatrixResponse> {
    const employee = await this.access.getEmployeeOrFail(employeeId);
    await this.access.requireCanView(actor, employee);
    const canEdit = await this.canEditQuiet(actor, employee);

    const { profileItems, extraItems } = await this.buildBuckets(employee);
    return { profileItems, extraItems, capabilities: { canEdit } };
  }

  async createExtra(
    actor: User,
    employeeId: string,
    input: CreateEmployeeSkillAssessmentRequest,
  ): Promise<EmployeeSkillMatrixItem> {
    const employee = await this.access.getEmployeeOrFail(employeeId);
    await this.access.requireCanEdit(actor, employee);

    return this.dataSource.transaction(async (manager) => {
      const skill = await this.lockSkill(manager, input.skillId);
      if (!skill.isActive) {
        throw new ConflictException('Skill is inactive');
      }
      const requirementIds = await this.requirementSkillIds(employee, manager);
      if (requirementIds.has(skill.id)) {
        throw new ConflictException(
          'Cannot manually add a current position requirement skill',
        );
      }
      this.assertLevelInScale(skill, input.level ?? null);

      const result = await this.assessmentsFacade.insertConfirmedIfAbsent(
        manager,
        {
          employeeId: employee.id,
          skillId: skill.id,
          level: input.level ?? null,
          assessedBy: actor.id,
          assessedAt: new Date(),
        },
      );
      if (result === 'already_exists') {
        throw new ConflictException('Confirmed assessment already exists');
      }

      const row = await manager.getRepository(EmployeeSkillAssessment).findOne({
        where: {
          employeeId: employee.id,
          skillId: skill.id,
          assessmentType: 'confirmed',
        },
        relations: { skill: true },
      });
      if (!row?.skill) throw new NotFoundException('Assessment not found');
      return this.toExtraItem(row);
    });
  }

  async updateLevel(
    actor: User,
    employeeId: string,
    assessmentId: string,
    input: UpdateEmployeeSkillAssessmentRequest,
  ): Promise<EmployeeSkillMatrixItem> {
    const employee = await this.access.getEmployeeOrFail(employeeId);
    await this.access.requireCanEdit(actor, employee);

    return this.dataSource.transaction(async (manager) => {
      const row = await manager.getRepository(EmployeeSkillAssessment).findOne({
        where: {
          id: assessmentId,
          employeeId: employee.id,
          assessmentType: 'confirmed',
        },
      });
      if (!row) throw new NotFoundException('Assessment not found');

      const skill = await this.lockSkill(manager, row.skillId);
      this.assertLevelInScale(skill, input.level);

      row.level = input.level;
      row.assessedBy = actor.id;
      row.assessedAt = new Date();
      await manager.getRepository(EmployeeSkillAssessment).save(row);

      return this.toMatrixItemForSkill(manager, employee, skill.id);
    });
  }

  /**
   * Set confirmed level by skillId (People matrix primary write).
   * Updates existing row, or inserts for a current position requirement.
   */
  async upsertLevel(
    actor: User,
    employeeId: string,
    input: {
      skillId: string;
      level: number | null;
    },
  ): Promise<EmployeeSkillMatrixItem> {
    const employee = await this.access.getEmployeeOrFail(employeeId);
    await this.access.requireCanEdit(actor, employee);

    return this.dataSource.transaction(async (manager) => {
      const skill = await this.lockSkill(manager, input.skillId);
      if (!skill.isActive) {
        throw new ConflictException('Skill is inactive');
      }
      this.assertLevelInScale(skill, input.level);

      const existing = await manager.getRepository(EmployeeSkillAssessment).findOne({
        where: {
          employeeId: employee.id,
          skillId: skill.id,
          assessmentType: 'confirmed',
        },
      });
      const requirementIds = await this.requirementSkillIds(employee, manager);
      const decision = decideSkillMatrixUpsert({
        hasConfirmedAssessment: !!existing,
        isCurrentRequirement: requirementIds.has(skill.id),
      });

      if (decision.action === 'update_existing' && existing) {
        existing.level = input.level;
        existing.assessedBy = actor.id;
        existing.assessedAt = new Date();
        await manager.getRepository(EmployeeSkillAssessment).save(existing);
        return this.toMatrixItemForSkill(manager, employee, skill.id);
      }

      if (decision.action === 'reject_not_on_matrix') {
        throw new ConflictException(
          'Cannot create assessment for a non-requirement skill; add as extra first',
        );
      }

      // insert_requirement
      const result = await this.assessmentsFacade.insertConfirmedIfAbsent(
        manager,
        {
          employeeId: employee.id,
          skillId: skill.id,
          level: input.level,
          assessedBy: actor.id,
          assessedAt: new Date(),
        },
      );
      if (result === 'already_exists') {
        // Race: another TX inserted — reload and update.
        const raced = await manager.getRepository(EmployeeSkillAssessment).findOne({
          where: {
            employeeId: employee.id,
            skillId: skill.id,
            assessmentType: 'confirmed',
          },
        });
        if (!raced) throw new ConflictException('Confirmed assessment race');
        raced.level = input.level;
        raced.assessedBy = actor.id;
        raced.assessedAt = new Date();
        await manager.getRepository(EmployeeSkillAssessment).save(raced);
      }

      return this.toMatrixItemForSkill(manager, employee, skill.id);
    });
  }

  async deleteExtra(
    actor: User,
    employeeId: string,
    assessmentId: string,
  ): Promise<void> {
    const employee = await this.access.getEmployeeOrFail(employeeId);
    await this.access.requireCanEdit(actor, employee);

    await this.dataSource.transaction(async (manager) => {
      const row = await manager.getRepository(EmployeeSkillAssessment).findOne({
        where: {
          id: assessmentId,
          employeeId: employee.id,
          assessmentType: 'confirmed',
        },
      });
      if (!row) throw new NotFoundException('Assessment not found');

      await this.lockSkill(manager, row.skillId);
      const requirementIds = await this.requirementSkillIds(employee, manager);
      if (requirementIds.has(row.skillId)) {
        throw new ConflictException(
          'Cannot delete assessment for a current position requirement',
        );
      }
      await manager.getRepository(EmployeeSkillAssessment).remove(row);
    });
  }

  private async canEditQuiet(actor: User, employee: Employee): Promise<boolean> {
    try {
      await this.access.requireCanEdit(actor, employee);
      return true;
    } catch {
      return false;
    }
  }

  private async buildBuckets(employee: Employee): Promise<{
    profileItems: EmployeeSkillMatrixItem[];
    extraItems: EmployeeSkillMatrixItem[];
  }> {
    const ea = await this.currentEmployment.resolve(employee);
    const positionId = ea?.positionId ?? null;

    const confirmed = await this.assessmentsFacade.listForEmployee(employee.id);
    const bySkillId = new Map(confirmed.map((a) => [a.skillId, a]));

    const profileItems: EmployeeSkillMatrixItem[] = [];
    const requirementIds = new Set<string>();

    if (positionId) {
      const reqs = await this.requirements.find({
        where: { positionId },
        relations: { skill: true },
        order: { skillId: 'ASC' },
      });
      for (const req of reqs) {
        if (!req.skill) continue;
        requirementIds.add(req.skillId);
        const assessment = bySkillId.get(req.skillId) ?? null;
        profileItems.push(this.toProfileItem(req.skill, assessment, req));
      }
    }

    const { extraSkillIds } = classifyEmployeeSkillMatrixBuckets({
      requirementSkillIds: [...requirementIds],
      confirmedSkillIds: confirmed.map((c) => c.skillId),
    });

    const extraItems: EmployeeSkillMatrixItem[] = [];
    for (const skillId of extraSkillIds) {
      const row = bySkillId.get(skillId);
      if (!row?.skill) continue;
      extraItems.push(this.toExtraItem(row));
    }

    return { profileItems, extraItems };
  }

  private async toMatrixItemForSkill(
    manager: EntityManager,
    employee: Employee,
    skillId: string,
  ): Promise<EmployeeSkillMatrixItem> {
    const saved = await manager.getRepository(EmployeeSkillAssessment).findOne({
      where: {
        employeeId: employee.id,
        skillId,
        assessmentType: 'confirmed',
      },
      relations: { skill: true },
    });
    if (!saved?.skill) throw new NotFoundException('Assessment not found');

    const requirementIds = await this.requirementSkillIds(employee, manager);
    if (!requirementIds.has(saved.skillId)) {
      return this.toExtraItem(saved);
    }
    const ea = await this.currentEmployment.resolve(employee, manager);
    const req = ea?.positionId
      ? await manager.getRepository(PositionSkillRequirement).findOne({
          where: { positionId: ea.positionId, skillId: saved.skillId },
        })
      : null;
    return this.toProfileItem(saved.skill, saved, req);
  }

  private async requirementSkillIds(
    employee: Employee,
    manager?: EntityManager,
  ): Promise<Set<string>> {
    const ea = await this.currentEmployment.resolve(employee, manager);
    const positionId = ea?.positionId ?? null;
    if (!positionId) return new Set();
    const repo = manager
      ? manager.getRepository(PositionSkillRequirement)
      : this.requirements;
    const rows = await repo.find({
      where: { positionId },
      select: ['skillId'],
    });
    return new Set(rows.map((r) => r.skillId));
  }

  private async lockSkill(
    manager: EntityManager,
    skillId: string,
  ): Promise<Skill> {
    const skill = await manager.getRepository(Skill).findOne({
      where: { id: skillId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!skill) throw new NotFoundException('Skill not found');
    return skill;
  }

  private assertLevelInScale(
    skill: Skill,
    level: number | null,
  ): void {
    if (level === null) return;
    if (!Number.isInteger(level) || level < skill.scaleMin || level > skill.scaleMax) {
      throw new BadRequestException(
        `level must be ${skill.scaleMin}..${skill.scaleMax} or null`,
      );
    }
  }

  private toProfileItem(
    skill: Skill,
    assessment: EmployeeSkillAssessment | null,
    req: PositionSkillRequirement | null | undefined,
  ): EmployeeSkillMatrixItem {
    return {
      skill: {
        id: skill.id,
        code: skill.code,
        name: skill.name,
        scaleKind: skill.scaleKind,
        scaleMin: skill.scaleMin,
        scaleMax: skill.scaleMax,
      },
      assessment: assessment
        ? {
            id: assessment.id,
            level: assessment.level,
            assessedBy: assessment.assessedBy,
            assessedAt: assessment.assessedAt.toISOString(),
          }
        : null,
      requirement: req
        ? {
            targetLevel: req.targetLevel,
            required: req.required,
            weight: req.weight,
          }
        : {
            targetLevel: null,
            required: false,
            weight: null,
          },
    };
  }

  private toExtraItem(row: EmployeeSkillAssessment): EmployeeSkillMatrixItem {
    const skill = row.skill!;
    return {
      skill: {
        id: skill.id,
        code: skill.code,
        name: skill.name,
        scaleKind: skill.scaleKind,
        scaleMin: skill.scaleMin,
        scaleMax: skill.scaleMax,
      },
      assessment: {
        id: row.id,
        level: row.level,
        assessedBy: row.assessedBy,
        assessedAt: row.assessedAt.toISOString(),
      },
      requirement: null,
    };
  }
}
