import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Employee } from './employee.entity';

/**
 * Organization Profile Core SoT for People «Про себе».
 * last_source_submission_id is opaque — no FK / relation to Questionnaires.
 */
@Entity({ name: 'employee_about' })
export class EmployeeAbout {
  @PrimaryColumn({ name: 'employee_id', type: 'uuid' })
  employeeId!: string;

  @ManyToOne(() => Employee, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'employee_id' })
  employee?: Employee;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  answers!: Record<string, unknown>;

  @Column({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @Column({ name: 'updated_by_user_id', type: 'uuid', nullable: true })
  updatedByUserId!: string | null;

  /** Opaque questionnaire submission id — informational only. */
  @Column({ name: 'last_source_submission_id', type: 'uuid', nullable: true })
  lastSourceSubmissionId!: string | null;

  @Column({ name: 'last_synced_at', type: 'timestamptz', nullable: true })
  lastSyncedAt!: Date | null;
}
