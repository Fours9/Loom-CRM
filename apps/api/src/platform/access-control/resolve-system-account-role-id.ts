import { EntityManager } from 'typeorm';
import { AccountRole } from './account-role.entity';
import { SystemAccountRoleCode } from './system-account-role-codes';

/**
 * Look up a seeded system role id. Throws when the seed is missing so callers
 * never silently insert a User without an account role.
 */
export async function resolveSystemAccountRoleId(
  manager: EntityManager,
  code: SystemAccountRoleCode,
): Promise<string> {
  const role = await manager.getRepository(AccountRole).findOne({
    where: { code },
  });
  if (!role) {
    throw new Error(`System account role "${code}" is missing`);
  }
  return role.id;
}

export async function findSystemAccountRoleByCode(
  manager: EntityManager,
  code: SystemAccountRoleCode,
): Promise<AccountRole> {
  const role = await manager.getRepository(AccountRole).findOne({
    where: { code },
  });
  if (!role) {
    throw new Error(`System account role "${code}" is missing`);
  }
  return role;
}
