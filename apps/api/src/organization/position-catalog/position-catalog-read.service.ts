import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import type {
  PositionCatalogContextV1,
  PositionDutyContext,
  PositionGoalTemplateContext,
  PositionSkillContext,
  QuestionnaireContextV2,
} from '@loom/contracts-questionnaires';
import { Employee } from '../employees/employee.entity';
import { EmploymentAssignment } from '../employees/employment-assignment.entity';
import { Position } from '../positions/position.entity';
import { Department } from '../departments/department.entity';
import { Direction } from '../companies/direction.entity';
import { PositionSkillRequirement } from '../position-requirements/position-skill-requirement.entity';
import { PositionDuty } from '../position-requirements/position-duty.entity';
import { PositionGoalTemplate } from '../position-requirements/position-goal-template.entity';
import {
  compareActiveEmploymentAssignments,
  resolveEmploymentPosition,
} from './resolve-employment-position';

type SnapshotRepos = {
  employee: Repository<Employee>;
  employmentAssignments: Repository<EmploymentAssignment>;
  positions: Repository<Position>;
  departments: Repository<Department>;
  directions: Repository<Direction>;
  skillRequirements: Repository<PositionSkillRequirement>;
  duties: Repository<PositionDuty>;
  goalTemplates: Repository<PositionGoalTemplate>;
};

/**
 * Canonical manager-aware Position Catalog reads for frozen questionnaire context.
 * Prefer this over calling CRUD services so capture can stay in the caller TX.
 */
@Injectable()
export class PositionCatalogReadService {
  constructor(
    @InjectRepository(Employee)
    private readonly employees: Repository<Employee>,
    @InjectRepository(EmploymentAssignment)
    private readonly employmentAssignments: Repository<EmploymentAssignment>,
    @InjectRepository(Position)
    private readonly positions: Repository<Position>,
    @InjectRepository(Department)
    private readonly departments: Repository<Department>,
    @InjectRepository(Direction)
    private readonly directions: Repository<Direction>,
    @InjectRepository(PositionSkillRequirement)
    private readonly skillRequirements: Repository<PositionSkillRequirement>,
    @InjectRepository(PositionDuty)
    private readonly duties: Repository<PositionDuty>,
    @InjectRepository(PositionGoalTemplate)
    private readonly goalTemplates: Repository<PositionGoalTemplate>,
  ) {}

  async buildSnapshotForEmployee(
    employeeId: string,
    manager?: EntityManager,
  ): Promise<QuestionnaireContextV2> {
    const repos = this.repos(manager);

    const employee = await repos.employee.findOne({ where: { id: employeeId } });
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    const currentAssignment = employee.currentAssignmentId
      ? await repos.employmentAssignments.findOne({
          where: { id: employee.currentAssignmentId },
        })
      : null;

    const activeRows = await repos.employmentAssignments.find({
      where: { employeeId: employee.id, status: 'active' },
    });
    activeRows.sort(compareActiveEmploymentAssignments);

    const resolved = resolveEmploymentPosition({
      employeeId: employee.id,
      currentAssignmentId: employee.currentAssignmentId,
      legacyPositionId: employee.positionId,
      legacyDepartmentId: employee.departmentId,
      currentAssignment: currentAssignment
        ? {
            id: currentAssignment.id,
            employeeId: currentAssignment.employeeId,
            status: currentAssignment.status,
            positionId: currentAssignment.positionId,
            departmentId: currentAssignment.departmentId,
            directionId: currentAssignment.directionId,
          }
        : null,
      activeAssignments: activeRows.map((a) => ({
        id: a.id,
        employeeId: a.employeeId,
        status: a.status,
        positionId: a.positionId,
        departmentId: a.departmentId,
        directionId: a.directionId,
      })),
    });

    return this.buildSnapshotFromResolvedPosition(
      {
        employeeId: employee.id,
        employmentAssignmentId: resolved.employmentAssignmentId,
        positionId: resolved.positionId,
        departmentId: resolved.departmentId,
        directionId: resolved.directionId,
      },
      repos,
    );
  }

  /**
   * Snapshot for an explicit position (not employment-resolved).
   * `employmentAssignmentId` is always null; org parents come from the Position row.
   */
  async buildSnapshotForPosition(
    employeeId: string,
    positionId: string | null,
    manager?: EntityManager,
  ): Promise<QuestionnaireContextV2> {
    const repos = this.repos(manager);

    const employee = await repos.employee.findOne({ where: { id: employeeId } });
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    let departmentId: string | null = null;
    let directionId: string | null = null;
    if (positionId) {
      const position = await repos.positions.findOne({
        where: { id: positionId },
      });
      if (!position) {
        throw new NotFoundException('Position not found');
      }
      departmentId = position.departmentId;
      directionId = position.directionId;
    }

    return this.buildSnapshotFromResolvedPosition(
      {
        employeeId: employee.id,
        employmentAssignmentId: null,
        positionId,
        departmentId,
        directionId,
      },
      repos,
    );
  }

  private repos(manager?: EntityManager): SnapshotRepos {
    if (!manager) {
      return {
        employee: this.employees,
        employmentAssignments: this.employmentAssignments,
        positions: this.positions,
        departments: this.departments,
        directions: this.directions,
        skillRequirements: this.skillRequirements,
        duties: this.duties,
        goalTemplates: this.goalTemplates,
      };
    }
    return {
      employee: manager.getRepository(Employee),
      employmentAssignments: manager.getRepository(EmploymentAssignment),
      positions: manager.getRepository(Position),
      departments: manager.getRepository(Department),
      directions: manager.getRepository(Direction),
      skillRequirements: manager.getRepository(PositionSkillRequirement),
      duties: manager.getRepository(PositionDuty),
      goalTemplates: manager.getRepository(PositionGoalTemplate),
    };
  }

  private async buildSnapshotFromResolvedPosition(
    resolved: {
      employeeId: string;
      employmentAssignmentId: string | null;
      positionId: string | null;
      departmentId: string | null;
      directionId: string | null;
    },
    repos: SnapshotRepos,
  ): Promise<QuestionnaireContextV2> {
    const capturedAt = new Date().toISOString();

    const departmentName = resolved.departmentId
      ? (
          await repos.departments.findOne({
            where: { id: resolved.departmentId },
          })
        )?.name ?? null
      : null;
    const directionName = resolved.directionId
      ? (
          await repos.directions.findOne({
            where: { id: resolved.directionId },
          })
        )?.name ?? null
      : null;

    if (!resolved.positionId) {
      const positionCatalog: PositionCatalogContextV1 = {
        employeeId: resolved.employeeId,
        employmentAssignmentId: resolved.employmentAssignmentId,
        positionId: null,
        positionName: null,
        departmentId: resolved.departmentId,
        departmentName,
        directionId: resolved.directionId,
        directionName,
        capturedAt,
        skills: [],
        goalTemplates: [],
        duties: [],
      };
      return { version: 2, positionCatalog };
    }

    const position = await repos.positions.findOne({
      where: { id: resolved.positionId },
    });

    const [skillReqs, duties, goals] = await Promise.all([
      repos.skillRequirements.find({
        where: { positionId: resolved.positionId },
        relations: ['skill', 'skill.group'],
        order: { skillId: 'ASC' },
      }),
      repos.duties.find({
        where: { positionId: resolved.positionId, isActive: true },
        order: { sortOrder: 'ASC', id: 'ASC' },
      }),
      repos.goalTemplates.find({
        where: { positionId: resolved.positionId, isActive: true },
        order: { sortOrder: 'ASC', id: 'ASC' },
      }),
    ]);

    const skills: PositionSkillContext[] = skillReqs
      .filter((r) => r.skill)
      .map((r) => ({
        skillId: r.skill!.id,
        code: r.skill!.code,
        labelUa: r.skill!.name,
        group: r.skill!.group?.code ?? '',
        targetLevel: r.targetLevel ?? null,
        required: r.required,
        weight: r.weight,
        scaleKind: r.skill!.scaleKind,
        scaleMin: r.skill!.scaleMin,
        scaleMax: r.skill!.scaleMax,
        source: 'position_requirement',
      }));

    const dutiesCtx: PositionDutyContext[] = duties.map((d) => ({
      title: d.title,
      description: d.description,
      sortOrder: d.sortOrder,
    }));

    const goalTemplates: PositionGoalTemplateContext[] = goals.map((g) => ({
      goalKind: g.goalKind,
      title: g.title,
      description: g.description,
      sortOrder: g.sortOrder,
    }));

    const positionCatalog: PositionCatalogContextV1 = {
      employeeId: resolved.employeeId,
      employmentAssignmentId: resolved.employmentAssignmentId,
      positionId: resolved.positionId,
      positionName: position?.name ?? null,
      departmentId: resolved.departmentId,
      departmentName,
      directionId: resolved.directionId,
      directionName,
      capturedAt,
      skills,
      goalTemplates,
      duties: dutiesCtx,
    };

    return { version: 2, positionCatalog };
  }
}
