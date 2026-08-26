import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { EmployeeSkillAssessment } from './employee-skill-assessment.entity';

export type InsertConfirmedAssessmentInput = {
  employeeId: string;
  skillId: string;
  level: number | null;
  assessedBy: string | null;
  assessedAt: Date;
  sourceSubmissionId?: string | null;
  sourceAssignmentId?: string | null;
};

@Injectable()
export class EmployeeSkillAssessmentsFacade {
  constructor(
    @InjectRepository(EmployeeSkillAssessment)
    private readonly assessments: Repository<EmployeeSkillAssessment>,
  ) {}

  listForEmployee(
    employeeId: string,
    manager?: EntityManager,
  ): Promise<EmployeeSkillAssessment[]> {
    const repo = manager
      ? manager.getRepository(EmployeeSkillAssessment)
      : this.assessments;
    return repo.find({
      where: { employeeId, assessmentType: 'confirmed' },
      relations: { skill: true },
      order: { assessedAt: 'DESC', id: 'ASC' },
    });
  }

  async hasConfirmed(
    employeeId: string,
    skillId: string,
    manager?: EntityManager,
  ): Promise<boolean> {
    const repo = manager
      ? manager.getRepository(EmployeeSkillAssessment)
      : this.assessments;
    const count = await repo.count({
      where: { employeeId, skillId, assessmentType: 'confirmed' },
    });
    return count > 0;
  }

  /**
   * Atomic insert against partial unique index — never UPDATE level.
   * Must use the passed EntityManager (proposal Accept TX).
   */
  async insertConfirmedIfAbsent(
    manager: EntityManager,
    input: InsertConfirmedAssessmentInput,
  ): Promise<'created' | 'already_exists'> {
    const rows = (await manager.query(
      `
      INSERT INTO employee_skill_assessments (
        id,
        employee_id,
        skill_id,
        assessment_type,
        level,
        assessed_by,
        assessed_at,
        source_submission_id,
        source_assignment_id,
        created_at,
        updated_at
      ) VALUES (
        gen_random_uuid(),
        $1,
        $2,
        'confirmed',
        $3,
        $4,
        $5,
        $6,
        $7,
        now(),
        now()
      )
      ON CONFLICT (employee_id, skill_id)
        WHERE assessment_type = 'confirmed'
      DO NOTHING
      RETURNING id
      `,
      [
        input.employeeId,
        input.skillId,
        input.level,
        input.assessedBy,
        input.assessedAt,
        input.sourceSubmissionId ?? null,
        input.sourceAssignmentId ?? null,
      ],
    )) as Array<{ id: string }>;

    return rows.length > 0 ? 'created' : 'already_exists';
  }

  async countForSkill(
    skillId: string,
    manager?: EntityManager,
  ): Promise<number> {
    const repo = manager
      ? manager.getRepository(EmployeeSkillAssessment)
      : this.assessments;
    return repo.count({ where: { skillId } });
  }
}
