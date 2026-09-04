import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { AccountRole } from './account-role.entity';

@Entity({ name: 'account_role_permissions' })
@Unique(['accountRoleId', 'permission'])
export class AccountRolePermission {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'account_role_id', type: 'uuid' })
  accountRoleId!: string;

  @Column({ type: 'varchar', length: 128 })
  permission!: string;

  @ManyToOne(() => AccountRole, (role) => role.extraPermissions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'account_role_id' })
  accountRole?: AccountRole;
}
