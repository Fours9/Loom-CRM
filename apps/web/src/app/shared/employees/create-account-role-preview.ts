import {
  resolveAccountRoleBridge,
  type AccountRoleBridgeResult,
} from '@loom/contracts-access-control';
import type { EmploymentManagementKind } from '@loom/contracts-employees';

/**
 * FE create-form preview: same pure bridge as BE IdentityRoleProjection.
 * `managementKind` MUST come from selected Position.managementKindTemplate only.
 */
export function resolveCreateAccountRolePreview(input: {
  requestedRoleCode: string | null;
  managementKind: EmploymentManagementKind;
}): AccountRoleBridgeResult {
  return resolveAccountRoleBridge(input);
}
