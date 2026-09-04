import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { User } from '../identity/user.entity';
import { Permission } from '../permissions/permission.names';
import {
  allAdminPermissions,
  isPermission,
  permissionsForPreset,
} from '../permissions/role-permissions';
import { AccountRole } from './account-role.entity';
import { AccountRolePermission } from './account-role-permission.entity';
import { AccountRoleSurface } from './account-role-surface.entity';
import type { AuthorizationContext } from './authorization-context';

/**
 * The authZ source of truth (ADR 0011 §3). Everything that asks
 * "may this user do X / see Y" resolves through here.
 */
@Injectable()
export class AuthorizationContextService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async resolve(
    userId: string,
    manager?: EntityManager,
  ): Promise<AuthorizationContext> {
    const em = manager ?? this.dataSource.manager;

    const user = await em.getRepository(User).findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('Invalid session');
    }
    if (!user.accountRoleId) {
      throw new UnauthorizedException('User has no account role');
    }

    const role = await em.getRepository(AccountRole).findOne({
      where: { id: user.accountRoleId },
    });
    if (!role) {
      throw new UnauthorizedException('Account role not found');
    }

    const [surfaceRows, permissionRows] = await Promise.all([
      em.getRepository(AccountRoleSurface).find({
        where: { accountRoleId: role.id },
      }),
      em.getRepository(AccountRolePermission).find({
        where: { accountRoleId: role.id },
      }),
    ]);

    return {
      userId: user.id,
      accountRole: {
        id: role.id,
        code: role.code,
        name: role.name,
        permissionPreset: role.permissionPreset,
        isAdminEquivalent: role.isAdminEquivalent,
        isSystem: role.isSystem,
      },
      permissions: this.effectivePermissions(role, permissionRows),
      surfaces: surfaceRows.map((row) => row.surfaceId).sort(),
      isAdminEquivalent: role.isAdminEquivalent,
    };
  }

  async isAdminEquivalent(
    userId: string,
    manager?: EntityManager,
  ): Promise<boolean> {
    const context = await this.resolve(userId, manager);
    return context.isAdminEquivalent;
  }

  /** Unknown permission stored in DB → throw rather than silently drop it. */
  private effectivePermissions(
    role: AccountRole,
    extras: AccountRolePermission[],
  ): Permission[] {
    if (role.isAdminEquivalent) {
      return allAdminPermissions();
    }
    const granted = new Set<Permission>(
      permissionsForPreset(role.permissionPreset),
    );
    for (const row of extras) {
      if (!isPermission(row.permission)) {
        throw new Error(
          `Account role ${role.id} grants unknown permission "${row.permission}"`,
        );
      }
      granted.add(row.permission);
    }
    return [...granted];
  }
}
