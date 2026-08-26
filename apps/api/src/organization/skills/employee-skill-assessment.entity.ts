import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Employee } from '../employees/employee.entity';
import { Skill } from './skill.entity';

export type EmployeeSkillAssessmentType = 'confirmed' | 'self' | 'manager';

@Entity({ name: 'employee_skill_assessments' })
export class EmployeeSkillAssessment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'employee_id', type: 'uuid' })
  employeeId!: string;

  @ManyToOne(() => Employee, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employee_id' })
  employee?: Employee;

  @Index()
  @Column({ name: 'skill_id', type: 'uuid' })
  skillId!: string;

  @ManyToOne(() => Skill, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'skill_id' })
  skill?: Skill;

  @Column({ name: 'assessment_type', type: 'varchar', length: 32 })
  assessmentType!: EmployeeSkillAssessmentType;

  @Column({ type: 'int', nullable: true })
  level!: number | null;

  @Column({ name: 'assessed_by', type: 'uuid', nullable: true })
  assessedBy!: string | null;

  @Column({ name: 'assessed_at', type: 'timestamptz' })
  assessedAt!: Date;

  /** Opaque provenance — no FK to questionnaires. */
  @Column({ name: 'source_submission_id', type: 'uuid', nullable: true })
  sourceSubmissionId!: string | null;

  /** Opaque provenance — no FK to questionnaires. */
  @Column({ name: 'source_assignment_id', type: 'uuid', nullable: true })
  sourceAssignmentId!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
