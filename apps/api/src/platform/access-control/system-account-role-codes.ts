/** Codes of the seeded, immutable-shape account roles (migration 1730000037000). */
export const SystemAccountRoleCode = {
  Employee: 'employee',
  DepartmentManager: 'department_manager',
  Director: 'director',
  Admin: 'admin',
} as const;

export type SystemAccountRoleCode =
  (typeof SystemAccountRoleCode)[keyof typeof SystemAccountRoleCode];

export const SYSTEM_ACCOUNT_ROLE_CODES: readonly SystemAccountRoleCode[] =
  Object.values(SystemAccountRoleCode);

export function isSystemAccountRoleCode(
  value: unknown,
): value is SystemAccountRoleCode {
  return (
    typeof value === 'string' &&
    (SYSTEM_ACCOUNT_ROLE_CODES as readonly string[]).includes(value)
  );
}

/**
 * Codes the leadership bridge is allowed to assign automatically.
 * Director / admin / custom roles are never auto-assigned (ADR 0011 §6).
 */
export const BRIDGE_MANAGED_ROLE_CODES: readonly SystemAccountRoleCode[] = [
  SystemAccountRoleCode.Employee,
  SystemAccountRoleCode.DepartmentManager,
];
