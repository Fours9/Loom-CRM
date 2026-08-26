import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { QuestionnaireAssignmentStatus } from './questionnaire.enums';
import { QuestionnaireTemplateVersion } from './questionnaire-template-version.entity';
import { QuestionnaireResponse } from './questionnaire-response.entity';

@Entity({ name: 'questionnaire_assignments' })
export class QuestionnaireAssignment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'template_version_id', type: 'uuid' })
  templateVersionId!: string;

  @ManyToOne(() => QuestionnaireTemplateVersion, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'template_version_id' })
  templateVersion!: QuestionnaireTemplateVersion;

  /** Immutable human code, e.g. 360-001. */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 32 })
  code!: string;

  /** Optional display title; null → template.title. */
  @Column({ type: 'varchar', length: 255, nullable: true })
  title!: string | null;

  /** Service HR note; read via questionnaires.read_assignment_comment. */
  @Column({ type: 'text', nullable: true })
  comment!: string | null;

  @Index()
  @Column({ name: 'employee_id', type: 'uuid', nullable: true })
  employeeId!: string | null;

  @Index()
  @Column({ name: 'detached_from_employee_id', type: 'uuid', nullable: true })
  detachedFromEmployeeId!: string | null;

  @Column({ name: 'assigned_by_user_id', type: 'uuid' })
  assignedByUserId!: string;

  @Column({ type: 'varchar', length: 32, default: 'assigned' })
  status!: QuestionnaireAssignmentStatus;

  @Column({ name: 'due_at', type: 'timestamptz', nullable: true })
  dueAt!: Date | null;

  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt!: Date | null;

  @Column({ name: 'submitted_at', type: 'timestamptz', nullable: true })
  submittedAt!: Date | null;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewedAt!: Date | null;

  /** Frozen QuestionnaireContext (V1|V2); null = legacy registry mode (ADR 0010). */
  @Column({ name: 'context_json', type: 'jsonb', nullable: true })
  contextJson!: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @OneToOne(() => QuestionnaireResponse, (r) => r.assignment)
  response?: QuestionnaireResponse | null;
}
