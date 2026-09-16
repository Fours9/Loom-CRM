import {
  resolveAccountRoleBridge,
  defaultSystemAccountRoleCodeFromLeadership,
  type AccountRoleBridgeResult,
} from '@loom/contracts-access-control';
import type { EmploymentManagementKind } from '@loom/contracts-employees';

/**
 * FE create-form preview: same pure SoT as contracts (identity — no leadership rewrite).
 */
export function resolveCreateAccountRolePreview(input: {
  requestedRoleCode: string | null;
  managementKind: EmploymentManagementKind;
}): AccountRoleBridgeResult {
  return resolveAccountRoleBridge(input);
}

export { defaultSystemAccountRoleCodeFromLeadership };
