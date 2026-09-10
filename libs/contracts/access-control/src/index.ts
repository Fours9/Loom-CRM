import type { EmploymentManagementKind } from '@loom/contracts-employees';

/**
 * System account-role codes the leadership bridge may auto-assign (ADR 0011).
 * Director / admin / custom are never auto-assigned.
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
  /** Requested code as provided (null = custom / unknown). */
  requestedRoleCode: string | null;
  /** Effective code after leadership bridge (null preserved for custom). */
  effectiveRoleCode: string | null;
  bridgeApplied: boolean;
};

/**
 * Pure leadership → system employee/DM bridge (ADR 0011).
 * Non-bridgeable codes (director/admin/custom) are preserved.
 */
export function resolveAccountRoleBridge(input: {
  requestedRoleCode: string | null;
  managementKind: EmploymentManagementKind;
}): AccountRoleBridgeResult {
  const requestedRoleCode = input.requestedRoleCode;
  if (!isBridgeManagedAccountRoleCode(requestedRoleCode)) {
    return {
      requestedRoleCode,
      effectiveRoleCode: requestedRoleCode,
      bridgeApplied: false,
    };
  }

  const desired: BridgeManagedAccountRoleCode =
    input.managementKind === 'none' ? 'employee' : 'department_manager';

  return {
    requestedRoleCode,
    effectiveRoleCode: desired,
    bridgeApplied: requestedRoleCode !== desired,
  };
}
