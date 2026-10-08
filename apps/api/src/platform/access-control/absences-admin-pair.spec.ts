import { BadRequestException } from '@nestjs/common';
import { Permission } from '../permissions/permission.names';
import {
  ABSENCES_ADMIN_PAIR_MISMATCH,
  ABSENCES_ADMIN_SURFACE,
  applyAbsencesAdminCapability,
  assertAbsencesAdminPairAligned,
} from './absences-admin-pair';

describe('assertAbsencesAdminPairAligned', () => {
  it('accepts aligned grant', () => {
    expect(() =>
      assertAbsencesAdminPairAligned({
        effectiveHasAdmin: true,
        surfaceIds: [ABSENCES_ADMIN_SURFACE],
        isAdminEquivalent: false,
      }),
    ).not.toThrow();
  });

  it('accepts aligned revoke', () => {
    expect(() =>
      assertAbsencesAdminPairAligned({
        effectiveHasAdmin: false,
        surfaceIds: ['nav.absences'],
        isAdminEquivalent: false,
      }),
    ).not.toThrow();
  });

  it('rejects permission without surface', () => {
    try {
      assertAbsencesAdminPairAligned({
        effectiveHasAdmin: true,
        surfaceIds: ['nav.absences'],
        isAdminEquivalent: false,
      });
      fail('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).getResponse()).toMatchObject({
        code: ABSENCES_ADMIN_PAIR_MISMATCH,
      });
    }
  });

  it('rejects surface without permission', () => {
    expect(() =>
      assertAbsencesAdminPairAligned({
        effectiveHasAdmin: false,
        surfaceIds: [ABSENCES_ADMIN_SURFACE],
        isAdminEquivalent: false,
      }),
    ).toThrow(BadRequestException);
  });

  it('adminEq bypasses pair check', () => {
    expect(() =>
      assertAbsencesAdminPairAligned({
        effectiveHasAdmin: true,
        surfaceIds: [],
        isAdminEquivalent: true,
      }),
    ).not.toThrow();
  });
});

describe('applyAbsencesAdminCapability', () => {
  it('keeps both sides in sync', () => {
    const on = applyAbsencesAdminCapability(
      [Permission.AbsencesApprove],
      ['nav.absences'],
      true,
    );
    expect(on.extraPermissions).toEqual([
      Permission.AbsencesApprove,
      Permission.AbsencesAdmin,
    ]);
    expect(on.surfaceIds).toContain(ABSENCES_ADMIN_SURFACE);

    const off = applyAbsencesAdminCapability(
      on.extraPermissions,
      on.surfaceIds,
      false,
    );
    expect(off.extraPermissions).not.toContain(Permission.AbsencesAdmin);
    expect(off.surfaceIds).not.toContain(ABSENCES_ADMIN_SURFACE);
  });
});
