import { bool, pick, strOrNull } from './coerce.mjs';

/**
 * @param {object} row
 * @param {string} loomId
 * @param {{ accountRoleId: string, legacyUserRole: string }} role
 */
export function mapUser(row, loomId, role) {
  return {
    id: loomId,
    email: String(pick(row, 'email')).toLowerCase(),
    password_hash: String(pick(row, 'password_hash', 'passwordHash')),
    role: role.legacyUserRole,
    account_role_id: role.accountRoleId,
    is_department_manager: bool(
      pick(row, 'is_department_manager', 'isDepartmentManager'),
      false,
    ),
    status: String(pick(row, 'status') ?? 'active'),
    must_change_password: bool(
      pick(row, 'must_change_password', 'mustChangePassword'),
      true,
    ),
    password_changed_at:
      pick(row, 'password_changed_at', 'passwordChangedAt') ?? null,
    token_version: Number(pick(row, 'token_version', 'tokenVersion') ?? 0),
    last_login_at: pick(row, 'last_login_at', 'lastLoginAt') ?? null,
  };
}
