import type { EmploymentManagementKind } from '@loom/contracts-employees';

/**
 * System account-role codes that may be **defaulted** from org leadership when
 * AccountRole is omitted at create/attach. They are never auto-rewritten after
 * an explicit choice (ADR 0011 — AccountRole independent of managementKind).
 */
export const BRIDGE_MANAGED_ACCOUNT_ROLE_CODES = [
  'employee',
  'department_manager',
] as const;

export type BridgeManagedAccountRoleCode =
  (typeof BRIDGE_MANAGED_ACCOUNT_ROLE_CODES)[number];

export function isBridgeManagedAccountRoleCode(
  code: string | null | undefined,
): code is BridgeManagedAccountRoleCode {
  return (
    typeof code === 'string' &&
    (BRIDGE_MANAGED_ACCOUNT_ROLE_CODES as readonly string[]).includes(code)
  );
}

/** Employee-number letter driven by AccountRole intent (PW A/M/E). */
export type AccountRoleNumberPrefix = 'E' | 'M' | 'A';

/**
 * Single SoT: AccountRole → employee-number prefix letter.
 * Custom non-admin roles return null (caller falls back to org leadership).
 * Does **not** assign managementKind / EA (ADR 0011).
 */
export function resolveEmployeeNumberPrefixFromAccountRole(role: {
  code: string | null;
  isAdminEquivalent: boolean;
}): AccountRoleNumberPrefix | null {
  if (
    role.isAdminEquivalent ||
    role.code === 'admin' ||
    role.code === 'director'
  ) {
    return 'A';
  }
  if (role.code === 'department_manager') return 'M';
  if (role.code === 'employee') return 'E';
  return null;
}

export type AccountRoleBridgeResult = {
  requestedRoleCode: string | null;
  /** Always equals requested — AccountRole is not rewritten from leadership. */
  effectiveRoleCode: string | null;
  /** Always false; retained for audit/API compatibility. */
  bridgeApplied: boolean;
};

/**
 * Identity resolution: requested AccountRole code is effective.
 * `managementKind` is ignored (kept optional for call-site compatibility).
 * Leadership may still **seed a default** when role is omitted — see
 * {@link defaultSystemAccountRoleCodeFromLeadership}.
 */
export function resolveAccountRoleBridge(input: {
  requestedRoleCode: string | null;
  managementKind?: EmploymentManagementKind;
}): AccountRoleBridgeResult {
  void input.managementKind;
  return {
    requestedRoleCode: input.requestedRoleCode,
    effectiveRoleCode: input.requestedRoleCode,
    bridgeApplied: false,
  };
}

/**
 * Default system employee/DM when AccountRole was not explicitly chosen
 * (create without accountRoleId, attach-account). Not an overwrite of intent.
 */
export function defaultSystemAccountRoleCodeFromLeadership(
  managementKind: EmploymentManagementKind,
): BridgeManagedAccountRoleCode {
  return managementKind === 'none' ? 'employee' : 'department_manager';
}
