import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserRole } from '../../platform/identity/user.enums';

@Entity({ name: 'employees' })
export class Employee {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId!: string | null;

  @Column({ type: 'varchar', length: 64, default: UserRole.Employee })
  role!: UserRole;

  @Column({ name: 'is_department_manager', type: 'boolean', default: false })
  isDepartmentManager!: boolean;

  @Index({ unique: true })
  @Column({ name: 'employee_number', type: 'varchar', length: 64 })
  employeeNumber!: string;

  @Column({ name: 'first_name', type: 'varchar', length: 120 })
  firstName!: string;

  @Column({ name: 'last_name', type: 'varchar', length: 120 })
  lastName!: string;

  @Column({ name: 'middle_name', type: 'varchar', length: 120, nullable: true })
  middleName!: string | null;

  @Column({ name: 'work_email', type: 'varchar', length: 320, nullable: true })
  workEmail!: string | null;

  @Index()
  @Column({ name: 'department_id', type: 'uuid', nullable: true })
  departmentId!: string | null;

  @Index()
  @Column({ name: 'position_id', type: 'uuid', nullable: true })
  positionId!: string | null;

  @Column({ name: 'calendar_color', type: 'varchar', length: 32, nullable: true })
  calendarColor!: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
