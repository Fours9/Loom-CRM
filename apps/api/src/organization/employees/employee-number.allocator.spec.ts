import type { ManagerMembershipState } from './managed-department-writes';
import { ManagementKind } from '../employment-catalog/management-kind';
import {
  employeeNumberPrefixFromMembership,
  employeeNumberPrefixForCreate,
} from './employee-number.allocator';

describe('employeeNumberPrefixFromMembership', () => {
  it('uses M for any manager membership', () => {
    const m: ManagerMembershipState = {
      managementKind: ManagementKind.Departments,
      isDepartmentManager: true,
      managedDepartmentIds: ['d1'],
    };
    expect(employeeNumberPrefixFromMembership(m)).toBe('M');
  });

  it('uses E for none', () => {
    const m: ManagerMembershipState = {
      managementKind: ManagementKind.None,
      isDepartmentManager: false,
      managedDepartmentIds: [],
    };
    expect(employeeNumberPrefixFromMembership(m)).toBe('E');
  });

  it('uses M for direction kind', () => {
    const m: ManagerMembershipState = {
      managementKind: ManagementKind.Direction,
      isDepartmentManager: true,
      managedDepartmentIds: [],
    };
    expect(employeeNumberPrefixFromMembership(m)).toBe('M');
  });
});

describe('employeeNumberPrefixForCreate', () => {
  const noneMembership: ManagerMembershipState = {
    managementKind: ManagementKind.None,
    isDepartmentManager: false,
    managedDepartmentIds: [],
  };

  it('uses A for admin / director even when membership is none', () => {
    expect(
      employeeNumberPrefixForCreate({
        accountRole: { code: 'admin', isAdminEquivalent: true },
        membership: noneMembership,
      }),
    ).toBe('A');
    expect(
      employeeNumberPrefixForCreate({
        accountRole: { code: 'director', isAdminEquivalent: false },
        membership: noneMembership,
      }),
    ).toBe('A');
  });

  it('uses M for department_manager AccountRole', () => {
    expect(
      employeeNumberPrefixForCreate({
        accountRole: { code: 'department_manager', isAdminEquivalent: false },
        membership: noneMembership,
      }),
    ).toBe('M');
  });

  it('falls back to membership for custom / omitted role', () => {
    expect(
      employeeNumberPrefixForCreate({
        accountRole: { code: null, isAdminEquivalent: false },
        membership: {
          managementKind: ManagementKind.Departments,
          isDepartmentManager: true,
          managedDepartmentIds: ['d1'],
        },
      }),
    ).toBe('M');
    expect(
      employeeNumberPrefixForCreate({
        accountRole: null,
        membership: noneMembership,
      }),
    ).toBe('E');
  });
});
