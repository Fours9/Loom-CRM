import { resolveCreateAccountRolePreview } from './create-account-role-preview';

describe('resolveCreateAccountRolePreview', () => {
  it('bridges employee → DM when position template is direction', () => {
    expect(
      resolveCreateAccountRolePreview({
        requestedRoleCode: 'employee',
        managementKind: 'direction',
      }),
    ).toEqual({
      requestedRoleCode: 'employee',
      effectiveRoleCode: 'department_manager',
      bridgeApplied: true,
    });
  });

  it('keeps employee when template is none', () => {
    expect(
      resolveCreateAccountRolePreview({
        requestedRoleCode: 'employee',
        managementKind: 'none',
      }),
    ).toEqual({
      requestedRoleCode: 'employee',
      effectiveRoleCode: 'employee',
      bridgeApplied: false,
    });
  });

  it('preserves director/admin/custom', () => {
    expect(
      resolveCreateAccountRolePreview({
        requestedRoleCode: 'director',
        managementKind: 'departments',
      }).bridgeApplied,
    ).toBe(false);
    expect(
      resolveCreateAccountRolePreview({
        requestedRoleCode: 'admin',
        managementKind: 'direction',
      }).effectiveRoleCode,
    ).toBe('admin');
    expect(
      resolveCreateAccountRolePreview({
        requestedRoleCode: null,
        managementKind: 'direction',
      }),
    ).toEqual({
      requestedRoleCode: null,
      effectiveRoleCode: null,
      bridgeApplied: false,
    });
  });
});
