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
import { Department } from '../departments/department.entity';
import { Position } from '../positions/position.entity';
import { Company } from '../companies/company.entity';
import { Direction } from '../companies/direction.entity';

export type EmploymentAssignmentStatus = 'active' | 'ended' | 'planned';

@Entity({ name: 'employment_assignments' })
export class EmploymentAssignment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'employee_id', type: 'uuid' })
  employeeId!: string;

  @ManyToOne(() => Employee, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employee_id' })
  employee?: Employee;

  @Column({ name: 'company_id', type: 'uuid', nullable: true })
  companyId!: string | null;

  @ManyToOne(() => Company, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'company_id' })
  company?: Company | null;

  @Column({ name: 'direction_id', type: 'uuid', nullable: true })
  directionId!: string | null;

  @ManyToOne(() => Direction, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'direction_id' })
  direction?: Direction | null;

  @Column({ name: 'department_id', type: 'uuid', nullable: true })
  departmentId!: string | null;

  @ManyToOne(() => Department, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'department_id' })
  department?: Department | null;

  @Column({ name: 'position_id', type: 'uuid', nullable: true })
  positionId!: string | null;

  @ManyToOne(() => Position, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'position_id' })
  position?: Position | null;

  @Column({ name: 'functional_role', type: 'varchar', length: 120, nullable: true })
  functionalRole!: string | null;

  @Column({ name: 'manager_employee_id', type: 'uuid', nullable: true })
  managerEmployeeId!: string | null;

  @Column({ name: 'mentor_employee_id', type: 'uuid', nullable: true })
  mentorEmployeeId!: string | null;

  @Column({ name: 'hr_responsible_employee_id', type: 'uuid', nullable: true })
  hrResponsibleEmployeeId!: string | null;

  @Column({ name: 'work_location', type: 'varchar', length: 255, nullable: true })
  workLocation!: string | null;

  @Column({ name: 'work_format', type: 'varchar', length: 64, nullable: true })
  workFormat!: string | null;

  @Column({ name: 'employment_type', type: 'varchar', length: 64, nullable: true })
  employmentType!: string | null;

  @Column({ name: 'contract_type', type: 'varchar', length: 64, nullable: true })
  contractType!: string | null;

  @Column({ name: 'start_date', type: 'date', nullable: true })
  startDate!: string | null;

  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate!: string | null;

  @Column({ name: 'probation_end_date', type: 'date', nullable: true })
  probationEndDate!: string | null;

  @Column({ type: 'varchar', length: 32, default: 'active' })
  status!: EmploymentAssignmentStatus;

  @Column({ name: 'change_reason', type: 'text', nullable: true })
  changeReason!: string | null;

  @Column({ name: 'created_by_user_id', type: 'uuid', nullable: true })
  createdByUserId!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
