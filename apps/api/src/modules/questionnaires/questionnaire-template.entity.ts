import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { QuestionnaireTemplateStatus } from './questionnaire.enums';
import { QuestionnaireTemplateVersion } from './questionnaire-template-version.entity';

@Entity({ name: 'questionnaire_templates' })
export class QuestionnaireTemplate {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64 })
  code!: string;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'varchar', length: 32, default: 'draft' })
  status!: QuestionnaireTemplateStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @OneToMany(() => QuestionnaireTemplateVersion, (v) => v.template)
  versions!: QuestionnaireTemplateVersion[];
}
