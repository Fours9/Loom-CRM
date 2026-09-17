import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { AccountRole } from './account-role.entity';

/**
 * Opaque questionnaire template codes granted to an AccountRole.
 * No FK to questionnaire_templates (Platform ↛ Questionnaires).
 */
@Entity({ name: 'account_role_questionnaire_templates' })
@Unique(['accountRoleId', 'templateCode'])
export class AccountRoleQuestionnaireTemplate {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'account_role_id', type: 'uuid' })
  accountRoleId!: string;

  @Column({ name: 'template_code', type: 'varchar', length: 64 })
  templateCode!: string;

  @ManyToOne(() => AccountRole, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'account_role_id' })
  accountRole?: AccountRole;
}
