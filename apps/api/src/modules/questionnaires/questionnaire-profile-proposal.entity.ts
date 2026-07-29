import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { QuestionnaireProposalStatus } from './questionnaire.enums';
import { QuestionnaireSubmission } from './questionnaire-submission.entity';

@Entity({ name: 'questionnaire_profile_proposals' })
export class QuestionnaireProfileProposal {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'submission_id', type: 'uuid' })
  submissionId!: string;

  @ManyToOne(() => QuestionnaireSubmission, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'submission_id' })
  submission!: QuestionnaireSubmission;

  @Index()
  @Column({ name: 'employee_id', type: 'uuid' })
  employeeId!: string;

  @Column({ name: 'target_section', type: 'varchar', length: 64 })
  targetSection!: string;

  @Column({ name: 'proposed_changes', type: 'jsonb' })
  proposedChanges!: Record<string, unknown>;

  @Column({ type: 'varchar', length: 32, default: 'pending' })
  status!: QuestionnaireProposalStatus;

  @Column({ name: 'reviewed_by_user_id', type: 'uuid', nullable: true })
  reviewedByUserId!: string | null;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
