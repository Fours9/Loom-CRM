import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { QuestionnaireTemplate } from './questionnaire-template.entity';

@Entity({ name: 'questionnaire_template_versions' })
@Unique(['templateId', 'version'])
export class QuestionnaireTemplateVersion {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'template_id', type: 'uuid' })
  templateId!: string;

  @ManyToOne(() => QuestionnaireTemplate, (t) => t.versions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'template_id' })
  template!: QuestionnaireTemplate;

  @Column({ type: 'int' })
  version!: number;

  @Column({ name: 'schema_json', type: 'jsonb' })
  schemaJson!: Record<string, unknown>;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
