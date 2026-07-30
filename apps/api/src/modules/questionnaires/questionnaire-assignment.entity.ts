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

  @Index()
  @Column({ name: 'employee_id', type: 'uuid' })
  employeeId!: string;

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

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @OneToOne(() => QuestionnaireResponse, (r) => r.assignment)
  response?: QuestionnaireResponse | null;
}
