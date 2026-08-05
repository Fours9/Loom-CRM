import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import type { QuestionnaireReviewStatus } from './questionnaire.enums';
import { QuestionnaireResponse } from './questionnaire-response.entity';

@Entity({ name: 'questionnaire_submissions' })
@Unique(['responseId', 'submissionNumber'])
export class QuestionnaireSubmission {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'response_id', type: 'uuid' })
  responseId!: string;

  @ManyToOne(() => QuestionnaireResponse, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'response_id' })
  response!: QuestionnaireResponse;

  @Column({ name: 'submission_number', type: 'int' })
  submissionNumber!: number;

  @Column({ name: 'snapshot_json', type: 'jsonb' })
  snapshotJson!: Record<string, unknown>;

  @Column({ name: 'submitted_by_user_id', type: 'uuid' })
  submittedByUserId!: string;

  @Column({ name: 'submitted_at', type: 'timestamptz' })
  submittedAt!: Date;

  @Column({
    name: 'review_status',
    type: 'varchar',
    length: 32,
    default: 'pending',
  })
  reviewStatus!: QuestionnaireReviewStatus;

  @Column({ name: 'reviewed_by_user_id', type: 'uuid', nullable: true })
  reviewedByUserId!: string | null;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewedAt!: Date | null;

  @Column({ name: 'review_comment', type: 'text', nullable: true })
  reviewComment!: string | null;

  @Column({
    name: 'change_request_resolution',
    type: 'varchar',
    length: 32,
    nullable: true,
  })
  changeRequestResolution!: 'completed' | 'declined' | null;

  @Column({
    name: 'change_request_resolved_by_user_id',
    type: 'uuid',
    nullable: true,
  })
  changeRequestResolvedByUserId!: string | null;

  @Column({
    name: 'change_request_resolved_at',
    type: 'timestamptz',
    nullable: true,
  })
  changeRequestResolvedAt!: Date | null;
}
