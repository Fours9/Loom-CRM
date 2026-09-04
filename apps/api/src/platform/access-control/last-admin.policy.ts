import {
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { User } from '../identity/user.entity';
import { UserStatus } from '../identity/user.enums';
import { AccountRole } from './account-role.entity';

/**
 * Ensure the system never drops to zero active adminEquivalent users.
 */
@Injectable()
export class LastAdminPolicy {
  async countActiveAdminEquivalent(
    manager: EntityManager,
  ): Promise<number> {
    return manager
      .createQueryBuilder(User, 'u')
      .innerJoin(AccountRole, 'r', 'r.id = u.account_role_id')
      .where('u.status = :status', { status: UserStatus.Active })
      .andWhere('r.is_admin_equivalent = true')
      .getCount();
  }

  /**
   * Call when a mutation would remove adminEquivalent contribution from a user
   * (or from all users of a role being demoted).
   */
  async assertNotRemovingLastAdmin(
    manager: EntityManager,
    options: {
      /** How many active adminEquivalent users would lose that status. */
      removingCount: number;
    },
  ): Promise<void> {
    if (options.removingCount <= 0) return;
    const total = await this.countActiveAdminEquivalent(manager);
    if (total - options.removingCount < 1) {
      throw new ConflictException({
        code: 'LAST_ADMIN',
        message: 'Cannot remove the last active admin-equivalent user',
      });
    }
  }

  async assertUserDemotionAllowed(
    manager: EntityManager,
    userId: string,
    nextIsAdminEquivalent: boolean,
  ): Promise<void> {
    if (nextIsAdminEquivalent) return;
    const user = await manager.getRepository(User).findOne({
      where: { id: userId },
    });
    if (!user?.accountRoleId || user.status !== UserStatus.Active) return;
    const role = await manager.getRepository(AccountRole).findOne({
      where: { id: user.accountRoleId },
    });
    if (!role?.isAdminEquivalent) return;
    await this.assertNotRemovingLastAdmin(manager, { removingCount: 1 });
  }

  async assertRoleDemotionAllowed(
    manager: EntityManager,
    roleId: string,
    nextIsAdminEquivalent: boolean,
  ): Promise<void> {
    if (nextIsAdminEquivalent) return;
    const role = await manager.getRepository(AccountRole).findOne({
      where: { id: roleId },
    });
    if (!role?.isAdminEquivalent) return;
    const affected = await manager
      .createQueryBuilder(User, 'u')
      .where('u.account_role_id = :roleId', { roleId })
      .andWhere('u.status = :status', { status: UserStatus.Active })
      .getCount();
    await this.assertNotRemovingLastAdmin(manager, {
      removingCount: affected,
    });
  }
}
