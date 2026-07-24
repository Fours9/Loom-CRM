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

export type EmployeeContactType =
  | 'work_phone'
  | 'work_email'
  | 'work_telegram'
  | 'personal_phone'
  | 'personal_email'
  | 'personal_telegram';

export type EmployeeContactVisibility = 'work' | 'personal' | 'confidential';

@Entity({ name: 'employee_contacts' })
export class EmployeeContact {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'employee_id', type: 'uuid' })
  employeeId!: string;

  @ManyToOne(() => Employee, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'employee_id' })
  employee?: Employee;

  @Column({ type: 'varchar', length: 32 })
  type!: EmployeeContactType;

  @Column({ type: 'varchar', length: 320 })
  value!: string;

  @Column({ name: 'is_primary', type: 'boolean', default: false })
  isPrimary!: boolean;

  @Column({ type: 'varchar', length: 32, default: 'work' })
  visibility!: EmployeeContactVisibility;

  @Column({ name: 'verified_at', type: 'timestamptz', nullable: true })
  verifiedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
