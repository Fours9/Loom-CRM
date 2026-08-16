import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import type {
  PositionCatalogContextV1,
  PositionDutyContext,
  PositionGoalTemplateContext,
  PositionSkillContext,
} from '@loom/contracts-questionnaires';
import { isSkillCode } from '@loom/position-skill-catalog';
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
  ): Promise<PositionCatalogContextV1> {
    const employeeRepo = manager
      ? manager.getRepository(Employee)
      : this.employees;
    const eaRepo = manager
      ? manager.getRepository(EmploymentAssignment)
      : this.employmentAssignments;
    const positionRepo = manager
      ? manager.getRepository(Position)
      : this.positions;
    const departmentRepo = manager
      ? manager.getRepository(Department)
      : this.departments;
    const directionRepo = manager
      ? manager.getRepository(Direction)
      : this.directions;
    const skillReqRepo = manager
      ? manager.getRepository(PositionSkillRequirement)
      : this.skillRequirements;
    const dutyRepo = manager
      ? manager.getRepository(PositionDuty)
      : this.duties;
    const goalRepo = manager
      ? manager.getRepository(PositionGoalTemplate)
      : this.goalTemplates;

    const employee = await employeeRepo.findOne({ where: { id: employeeId } });
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    const currentAssignment = employee.currentAssignmentId
      ? await eaRepo.findOne({ where: { id: employee.currentAssignmentId } })
      : null;

    const activeRows = await eaRepo.find({
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

    const capturedAt = new Date().toISOString();

    const departmentName = resolved.departmentId
      ? (
          await departmentRepo.findOne({
            where: { id: resolved.departmentId },
          })
        )?.name ?? null
      : null;
    const directionName = resolved.directionId
      ? (
          await directionRepo.findOne({
            where: { id: resolved.directionId },
          })
        )?.name ?? null
      : null;

    if (!resolved.positionId) {
      return {
        employeeId: employee.id,
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
    }

    const position = await positionRepo.findOne({
      where: { id: resolved.positionId },
    });

    const [skillReqs, duties, goals] = await Promise.all([
      skillReqRepo.find({
        where: { positionId: resolved.positionId },
        relations: ['skill', 'skill.group'],
        order: { skillId: 'ASC' },
      }),
      dutyRepo.find({
        where: { positionId: resolved.positionId, isActive: true },
        order: { sortOrder: 'ASC', id: 'ASC' },
      }),
      goalRepo.find({
        where: { positionId: resolved.positionId, isActive: true },
        order: { sortOrder: 'ASC', id: 'ASC' },
      }),
    ]);

    const skills: PositionSkillContext[] = skillReqs
      .filter((r) => r.skill && isSkillCode(r.skill.code))
      .map((r) => ({
        code: r.skill!.code,
        labelUa: r.skill!.name,
        group: r.skill!.group?.code ?? '',
        targetLevel: r.targetLevel ?? null,
        required: r.required,
        weight: r.weight,
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

    return {
      employeeId: employee.id,
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
  }
}
