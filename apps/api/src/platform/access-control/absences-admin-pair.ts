import { BadRequestException } from '@nestjs/common';
import { Permission } from '../permissions/permission.names';

export const ABSENCES_ADMIN_SURFACE = 'absences.admin';

export const ABSENCES_ADMIN_PAIR_MISMATCH = 'ABSENCES_ADMIN_PAIR_MISMATCH';

/**
 * Fail-closed: effective AbsencesAdmin permission ↔ absences.admin surface.
 * Call after merging create/update/PUT …/surfaces into the full next extras + surfaces.
 *
 * adminEq bypasses physical pair (both exposure layers are bypassed).
 */
export function assertAbsencesAdminPairAligned(input: {
  effectiveHasAdmin: boolean;
  surfaceIds: readonly string[];
  isAdminEquivalent: boolean;
}): void {
  if (input.isAdminEquivalent) return;
  const surfaceHas = input.surfaceIds.includes(ABSENCES_ADMIN_SURFACE);
  if (input.effectiveHasAdmin !== surfaceHas) {
    throw new BadRequestException({
      code: ABSENCES_ADMIN_PAIR_MISMATCH,
      message:
        'absences.admin permission and surface must be granted or revoked together',
    });
  }
}

/** Settings checkbox helper: force both sides on or off. */
export function applyAbsencesAdminCapability(
  extras: string[],
  surfaces: string[],
  enabled: boolean,
): { extraPermissions: string[]; surfaceIds: string[] } {
  const extraPermissions = extras.filter((p) => p !== Permission.AbsencesAdmin);
  const surfaceIds = surfaces.filter((s) => s !== ABSENCES_ADMIN_SURFACE);
  if (enabled) {
    extraPermissions.push(Permission.AbsencesAdmin);
    surfaceIds.push(ABSENCES_ADMIN_SURFACE);
  }
  return { extraPermissions, surfaceIds };
}
