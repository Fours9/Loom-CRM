import {
  resolveManagerMembershipForCreate,
} from './managed-department-writes';
import type { Position } from '../positions/position.entity';

describe('resolveManagerMembershipForCreate', () => {
  const position = {
    id: 'p1',
    isDepartmentManagerTemplate: true,
  } as Position;

  it('copies template when no explicit values', () => {
    const r = resolveManagerMembershipForCreate({
      position,
      positionManagedDepartmentIds: ['d1', 'd2'],
      assignmentDepartmentId: 'd1',
    });
    expect(r.isDepartmentManager).toBe(true);
    expect(r.managedDepartmentIds).toEqual(['d1', 'd2']);
  });

  it('explicit false clears managed depts', () => {
    const r = resolveManagerMembershipForCreate({
      position,
      positionManagedDepartmentIds: ['d1'],
      explicitIsDepartmentManager: false,
      assignmentDepartmentId: 'd1',
    });
    expect(r.isDepartmentManager).toBe(false);
    expect(r.managedDepartmentIds).toEqual([]);
  });

  it('explicit enable with empty list defaults to assignment department', () => {
    const r = resolveManagerMembershipForCreate({
      position: null,
      positionManagedDepartmentIds: [],
      explicitIsDepartmentManager: true,
      explicitManagedDepartmentIds: [],
      assignmentDepartmentId: 'sales',
    });
    expect(r.isDepartmentManager).toBe(true);
    expect(r.managedDepartmentIds).toEqual(['sales']);
  });

  it('explicit managed list overrides template', () => {
    const r = resolveManagerMembershipForCreate({
      position,
      positionManagedDepartmentIds: ['d1'],
      explicitIsDepartmentManager: true,
      explicitManagedDepartmentIds: ['x', 'y'],
      assignmentDepartmentId: 'd1',
    });
    expect(r.managedDepartmentIds).toEqual(['x', 'y']);
  });
});
