import {
  Column,
  Entity,
  Index,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { QuestionnaireAssignment } from './questionnaire-assignment.entity';

@Entity({ name: 'questionnaire_responses' })
export class QuestionnaireResponse {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ name: 'assignment_id', type: 'uuid' })
  assignmentId!: string;

  @OneToOne(() => QuestionnaireAssignment, (a) => a.response, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'assignment_id' })
  assignment!: QuestionnaireAssignment;

  @Column({ name: 'answers_json', type: 'jsonb', default: () => "'{}'" })
  answersJson!: Record<string, unknown>;

  @Column({ type: 'int', default: 0 })
  revision!: number;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
