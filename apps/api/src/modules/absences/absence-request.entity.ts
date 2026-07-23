import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AbsenceRequestStatus, AbsenceType } from './absence.enums';

@Entity({ name: 'absence_requests' })
export class AbsenceRequest {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'employee_id', type: 'uuid' })
  employeeId!: string;

  @Column({ name: 'department_id_at_submission', type: 'uuid', nullable: true })
  departmentIdAtSubmission!: string | null;

  @Column({ name: 'position_id_at_submission', type: 'uuid', nullable: true })
  positionIdAtSubmission!: string | null;

  @Column({ name: 'employee_name_at_submission', type: 'varchar', length: 255 })
  employeeNameAtSubmission!: string;

  @Column({
    name: 'employee_number_at_submission',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  employeeNumberAtSubmission!: string | null;

  @Column({
    name: 'calendar_color_at_submission',
    type: 'varchar',
    length: 32,
    nullable: true,
  })
  calendarColorAtSubmission!: string | null;

  @Column({ type: 'varchar', length: 32 })
  type!: AbsenceType;

  @Column({ name: 'start_date', type: 'date' })
  startDate!: string;

  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate!: string | null;

  @Column({ name: 'absence_start_time', type: 'varchar', length: 8, nullable: true })
  absenceStartTime!: string | null;

  @Column({ name: 'absence_end_time', type: 'varchar', length: 8, nullable: true })
  absenceEndTime!: string | null;

  @Column({ name: 'is_unpaid', type: 'boolean', default: false })
  isUnpaid!: boolean;

  @Column({ type: 'text', nullable: true })
  reason!: string | null;

  @Column({ name: 'employee_comment', type: 'text', nullable: true })
  employeeComment!: string | null;

  @Column({ type: 'varchar', length: 32, default: AbsenceRequestStatus.Pending })
  status!: AbsenceRequestStatus;

  @Column({ type: 'int', default: 1 })
  version!: number;

  @Column({ name: 'created_by_user_id', type: 'uuid' })
  createdByUserId!: string;

  @Column({ name: 'decision_comment', type: 'text', nullable: true })
  decisionComment!: string | null;

  @Column({ name: 'adjustment_comment', type: 'text', nullable: true })
  adjustmentComment!: string | null;

  @Column({ name: 'deletion_comment', type: 'text', nullable: true })
  deletionComment!: string | null;

  @Column({ name: 'decided_at', type: 'timestamptz', nullable: true })
  decidedAt!: Date | null;

  @Column({ name: 'decided_by_user_id', type: 'uuid', nullable: true })
  decidedByUserId!: string | null;

  @Column({
    name: 'status_before_deletion_request',
    type: 'varchar',
    length: 32,
    nullable: true,
  })
  statusBeforeDeletionRequest!: AbsenceRequestStatus | null;

  @Column({ name: 'deletion_requested_at', type: 'timestamptz', nullable: true })
  deletionRequestedAt!: Date | null;

  @Column({ name: 'deletion_requested_by_user_id', type: 'uuid', nullable: true })
  deletionRequestedByUserId!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
