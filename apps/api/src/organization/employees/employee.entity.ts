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
import { User } from '../../platform/identity/user.entity';
import { UserRole } from '../../platform/identity/user.enums';
import { Department } from '../departments/department.entity';
import { Position } from '../positions/position.entity';

@Entity({ name: 'employees' })
export class Employee {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId!: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user?: User | null;

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

  @ManyToOne(() => Department, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'department_id' })
  department?: Department | null;

  @Index()
  @Column({ name: 'position_id', type: 'uuid', nullable: true })
  positionId!: string | null;

  @ManyToOne(() => Position, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'position_id' })
  position?: Position | null;

  @Column({ name: 'calendar_color', type: 'varchar', length: 32, nullable: true })
  calendarColor!: string | null;

  @Column({ name: 'phone_number', type: 'text', nullable: true })
  phoneNumber!: string | null;

  @Column({ type: 'text', nullable: true })
  telegram!: string | null;

  @Column({ name: 'personal_phone_number', type: 'text', nullable: true })
  personalPhoneNumber!: string | null;

  @Column({ name: 'personal_telegram', type: 'text', nullable: true })
  personalTelegram!: string | null;

  @Column({ name: 'personal_email', type: 'text', nullable: true })
  personalEmail!: string | null;

  @Column({ type: 'text', nullable: true })
  comment!: string | null;

  @Column({ name: 'admin_comment', type: 'text', nullable: true })
  adminComment!: string | null;

  @Column({ name: 'photo_url', type: 'text', nullable: true })
  photoUrl!: string | null;

  @Column({ name: 'profile_visibility_override', type: 'text', nullable: true })
  profileVisibilityOverride!: string | null;

  @Column({ name: 'absence_visibility_override', type: 'text', nullable: true })
  absenceVisibilityOverride!: string | null;

  @Column({
    name: 'show_absence_type_to_peers_override',
    type: 'text',
    nullable: true,
  })
  showAbsenceTypeToPeersOverride!: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
