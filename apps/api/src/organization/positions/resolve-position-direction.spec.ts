import { resolvePositionDirectionId } from './resolve-position-direction';

describe('resolvePositionDirectionId', () => {
  it('inherits department direction when department is set', () => {
    expect(
      resolvePositionDirectionId({
        hasDepartment: true,
        departmentDirectionId: 'dir-y',
      }),
    ).toEqual({ ok: true, directionId: 'dir-y' });
  });

  it('rejects explicit direction that mismatches department', () => {
    const r = resolvePositionDirectionId({
      hasDepartment: true,
      departmentDirectionId: 'dir-y',
      explicitDirectionId: 'dir-x',
    });
    expect(r.ok).toBe(false);
  });

  it('ignores absence of explicit id when dept changes (no old direction)', () => {
    expect(
      resolvePositionDirectionId({
        hasDepartment: true,
        departmentDirectionId: 'dir-y',
        explicitDirectionId: undefined,
      }),
    ).toEqual({ ok: true, directionId: 'dir-y' });
  });

  it('allows manual direction when no department', () => {
    expect(
      resolvePositionDirectionId({
        hasDepartment: false,
        departmentDirectionId: undefined,
        explicitDirectionId: 'dir-x',
      }),
    ).toEqual({ ok: true, directionId: 'dir-x' });
  });

  it('defaults to null when no department and no explicit direction', () => {
    expect(
      resolvePositionDirectionId({
        hasDepartment: false,
        departmentDirectionId: undefined,
      }),
    ).toEqual({ ok: true, directionId: null });
  });
});
