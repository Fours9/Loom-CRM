import {
  defaultSystemAccountRoleCodeFromLeadership,
  resolveCreateAccountRolePreview,
} from './create-account-role-preview';

describe('resolveCreateAccountRolePreview', () => {
  it('keeps requested Manager even when position has no leadership', () => {
    expect(
      resolveCreateAccountRolePreview({
        requestedRoleCode: 'department_manager',
        managementKind: 'none',
      }),
    ).toEqual({
      requestedRoleCode: 'department_manager',
      effectiveRoleCode: 'department_manager',
      bridgeApplied: false,
    });
  });

  it('keeps requested employee even when position leads', () => {
    expect(
      resolveCreateAccountRolePreview({
        requestedRoleCode: 'employee',
        managementKind: 'direction',
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

describe('defaultSystemAccountRoleCodeFromLeadership', () => {
  it('seeds DM only when leadership is present (omitted-role default)', () => {
    expect(defaultSystemAccountRoleCodeFromLeadership('none')).toBe('employee');
    expect(defaultSystemAccountRoleCodeFromLeadership('departments')).toBe(
      'department_manager',
    );
    expect(defaultSystemAccountRoleCodeFromLeadership('direction')).toBe(
      'department_manager',
    );
  });
});
