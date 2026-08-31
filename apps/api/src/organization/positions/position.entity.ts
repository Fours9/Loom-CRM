import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Department } from '../departments/department.entity';
import { Direction } from '../companies/direction.entity';
import { PositionSkillRequirement } from '../position-requirements/position-skill-requirement.entity';
import { PositionDuty } from '../position-requirements/position-duty.entity';
import { PositionGoalTemplate } from '../position-requirements/position-goal-template.entity';
import { PositionManagedDepartment } from './position-managed-department.entity';

@Entity({ name: 'positions' })
export class Position {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  /** Optional parent department. */
  @Index()
  @Column({ name: 'department_id', type: 'uuid', nullable: true })
  departmentId!: string | null;

  @ManyToOne(() => Department, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'department_id' })
  department?: Department | null;

  /**
   * Optional direction.
   * When departmentId is set → must equal department.directionId (synced by service).
   * When departmentId is null → may be chosen manually.
   */
  @Index()
  @Column({ name: 'direction_id', type: 'uuid', nullable: true })
  directionId!: string | null;

  @ManyToOne(() => Direction, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'direction_id' })
  direction?: Direction | null;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  /** Template: new EA copies this unless create form overrides. */
  @Column({ name: 'is_department_manager_template', type: 'boolean', default: false })
  isDepartmentManagerTemplate!: boolean;

  @OneToMany(() => PositionManagedDepartment, (row) => row.position)
  managedDepartments?: PositionManagedDepartment[];

  @OneToMany(() => PositionSkillRequirement, (row) => row.position)
  skillRequirements?: PositionSkillRequirement[];

  @OneToMany(() => PositionDuty, (row) => row.position)
  duties?: PositionDuty[];

  @OneToMany(() => PositionGoalTemplate, (row) => row.position)
  goalTemplates?: PositionGoalTemplate[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
