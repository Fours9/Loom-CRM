import { homeWorkspaceActions, resolveMyProfilePath } from './home-workspace.links';

describe('home-workspace.links', () => {
  it('resolveMyProfilePath is fail-closed for missing employee', () => {
    expect(resolveMyProfilePath(null)).toBeNull();
    expect(resolveMyProfilePath(undefined)).toBeNull();
    expect(resolveMyProfilePath('')).toBeNull();
    expect(resolveMyProfilePath('   ')).toBeNull();
  });

  it('resolveMyProfilePath builds people profile path', () => {
    expect(resolveMyProfilePath('emp-1')).toBe('/people/emp-1');
  });

  it('homeWorkspaceActions order and calendar path are stable', () => {
    const withEmp = homeWorkspaceActions('e1');
    expect(withEmp.map((a) => a.id)).toEqual(['profile', 'work-calendar']);
    expect(withEmp[0].path).toBe('/people/e1');
    expect(withEmp[0].blurb.length).toBeGreaterThan(0);
    expect(withEmp[1].path).toBe('/absences');
    expect(withEmp[1].blurb.length).toBeGreaterThan(0);

    const noEmp = homeWorkspaceActions(null);
    expect(noEmp[0].path).toBeNull();
    expect(noEmp[1].path).toBe('/absences');
  });
});
