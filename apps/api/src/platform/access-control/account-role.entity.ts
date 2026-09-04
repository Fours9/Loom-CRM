import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AccountRoleSurface } from './account-role-surface.entity';
import { AccountRolePermission } from './account-role-permission.entity';

/** Permission preset the role inherits; extras are additive. */
export type AccountRolePermissionPreset =
  | 'employee'
  | 'department_manager'
  | 'admin';

@Entity({ name: 'account_roles' })
export class AccountRole {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Stable code for system roles; null for custom roles. */
  @Column({ type: 'varchar', length: 64, nullable: true, unique: true })
  code!: string | null;

  @Column({ type: 'varchar', length: 160 })
  name!: string;

  @Column({ name: 'permission_preset', type: 'varchar', length: 64 })
  permissionPreset!: AccountRolePermissionPreset;

  @Column({ name: 'is_admin_equivalent', type: 'boolean', default: false })
  isAdminEquivalent!: boolean;

  /** System roles: code / preset / isAdminEquivalent are immutable. */
  @Column({ name: 'is_system', type: 'boolean', default: false })
  isSystem!: boolean;

  @OneToMany(() => AccountRoleSurface, (row) => row.accountRole)
  surfaces?: AccountRoleSurface[];

  @OneToMany(() => AccountRolePermission, (row) => row.accountRole)
  extraPermissions?: AccountRolePermission[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
