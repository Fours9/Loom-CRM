import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { AccountRole } from './account-role.entity';
import { AppSurface } from './app-surface.entity';

@Entity({ name: 'account_role_surfaces' })
@Unique(['accountRoleId', 'surfaceId'])
export class AccountRoleSurface {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'account_role_id', type: 'uuid' })
  accountRoleId!: string;

  @Column({ name: 'surface_id', type: 'text' })
  surfaceId!: string;

  @ManyToOne(() => AccountRole, (role) => role.surfaces, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'account_role_id' })
  accountRole?: AccountRole;

  @ManyToOne(() => AppSurface, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'surface_id' })
  surface?: AppSurface;
}
