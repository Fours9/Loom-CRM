/**
 * Fail-closed PW role → Loom dual fields.
 * accountRoleCode → account_roles.code (AuthZ SoT)
 * legacyUserRole → users.role / employees.role mirror via userRoleMirrorFor logic
 */

const KNOWN_ACCOUNT_ROLE_CODES = new Set([
  'employee',
  'department_manager',
  'director',
  'admin',
]);

/**
 * Mirror of apps/api account-role-mirror.ts userRoleMirrorFor.
 * @param {{ isAdminEquivalent: boolean, permissionPreset: string }} role
 * @returns {'admin'|'department_manager'|'employee'}
 */
export function userRoleMirrorFor(role) {
  if (role.isAdminEquivalent) return 'admin';
  return role.permissionPreset === 'department_manager'
    ? 'department_manager'
    : 'employee';
}

/**
 * @param {string|null|undefined} pwRole
 * @param {Map<string, {id: string, code: string, permissionPreset: string, isAdminEquivalent: boolean}>} rolesByCode
 * @returns {{ accountRoleCode: string, legacyUserRole: string, accountRoleId: string }}
 */
export function mapPwRole(pwRole, rolesByCode) {
  const code = String(pwRole ?? '').trim();
  if (!KNOWN_ACCOUNT_ROLE_CODES.has(code) || !rolesByCode.has(code)) {
    throw new Error(
      `Unknown or unmapped PW role "${pwRole}". Must match account_roles.code (${[...KNOWN_ACCOUNT_ROLE_CODES].join(', ')}). Fail-closed — no employee fallback.`,
    );
  }
  const target = rolesByCode.get(code);
  return {
    accountRoleCode: target.code,
    accountRoleId: target.id,
    legacyUserRole: userRoleMirrorFor(target),
  };
}
