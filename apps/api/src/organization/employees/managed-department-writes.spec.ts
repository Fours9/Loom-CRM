import {
  resolveManagerMembershipForCreate,
} from './managed-department-writes';
import type { Position } from '../positions/position.entity';
import { ManagementKind } from '../employment-catalog/management-kind';

describe('resolveManagerMembershipForCreate', () => {
  const position = {
    id: 'p1',
    isDepartmentManagerTemplate: true,
  } as Position;

  const base = {
    positionManagedDirectionIds: [] as string[],
    assignmentDirectionId: null as string | null,
  };

  it('copies template when no explicit values', () => {
    const r = resolveManagerMembershipForCreate({
      ...base,
      position,
      positionManagedDepartmentIds: ['d1', 'd2'],
      assignmentDepartmentId: 'd1',
    });
    expect(r.isDepartmentManager).toBe(true);
    expect(r.managedDepartmentIds).toEqual(['d1', 'd2']);
    expect(r.managedDirectionIds).toEqual([]);
  });

  it('explicit false clears managed depts', () => {
    const r = resolveManagerMembershipForCreate({
      ...base,
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
      ...base,
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
      ...base,
      position,
      positionManagedDepartmentIds: ['d1'],
      explicitIsDepartmentManager: true,
      explicitManagedDepartmentIds: ['x', 'y'],
      assignmentDepartmentId: 'd1',
    });
    expect(r.managedDepartmentIds).toEqual(['x', 'y']);
  });

  it('without explicit kind, ordinary Position stays none (create SoT)', () => {
    const ordinary = {
      id: 'p2',
      managementKindTemplate: 'none',
      isDepartmentManagerTemplate: false,
    } as Position;
    const r = resolveManagerMembershipForCreate({
      ...base,
      position: ordinary,
      positionManagedDepartmentIds: [],
      assignmentDepartmentId: 'd1',
    });
    expect(r.managementKind).toBe(ManagementKind.None);
    expect(r.isDepartmentManager).toBe(false);
  });

  it('explicit direction would escalate past Position none (assignment path only)', () => {
    const ordinary = {
      id: 'p2',
      managementKindTemplate: 'none',
      isDepartmentManagerTemplate: false,
    } as Position;
    const r = resolveManagerMembershipForCreate({
      ...base,
      position: ordinary,
      positionManagedDepartmentIds: [],
      assignmentDepartmentId: 'd1',
      assignmentDirectionId: 'dir-1',
      explicitManagementKind: ManagementKind.Direction,
    });
    expect(r.managementKind).toBe(ManagementKind.Direction);
    expect(r.isDepartmentManager).toBe(true);
    expect(r.managedDirectionIds).toEqual(['dir-1']);
  });

  it('copies managed directions from position template', () => {
    const director = {
      id: 'p3',
      managementKindTemplate: ManagementKind.Direction,
      isDepartmentManagerTemplate: true,
    } as Position;
    const r = resolveManagerMembershipForCreate({
      position: director,
      positionManagedDepartmentIds: [],
      positionManagedDirectionIds: ['dir-a', 'dir-b'],
      assignmentDepartmentId: null,
      assignmentDirectionId: 'dir-a',
    });
    expect(r.managementKind).toBe(ManagementKind.Direction);
    expect(r.managedDirectionIds).toEqual(['dir-a', 'dir-b']);
    expect(r.managedDepartmentIds).toEqual([]);
  });
});
