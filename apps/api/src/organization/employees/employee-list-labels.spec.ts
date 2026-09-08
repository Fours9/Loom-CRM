import {
  compareEmployeeDirectoryLabels,
  resolveEmployeeListRoleLabel,
  resolveEmployeeListStatusLabel,
  unionIdLists,
} from './employee-list-labels';

describe('employee-list-labels', () => {
  describe('unionIdLists', () => {
    it('ORs singular and multi without duplicates', () => {
      expect(unionIdLists('a', ['b', 'a'])).toEqual(['b', 'a']);
      expect(unionIdLists(undefined, undefined)).toEqual([]);
      expect(unionIdLists('x', undefined)).toEqual(['x']);
    });
  });

  describe('resolveEmployeeListRoleLabel', () => {
    it('uses legacy UA label when no account', () => {
      expect(
        resolveEmployeeListRoleLabel({
          hasAccount: false,
          legacyRole: 'employee',
          accountRole: null,
        }),
      ).toBe('Працівник');
    });

    it('uses AccountRole.name when has account', () => {
      expect(
        resolveEmployeeListRoleLabel({
          hasAccount: true,
          legacyRole: 'employee',
          accountRole: {
            id: '1',
            code: 'director',
            name: 'Директор',
            isAdminEquivalent: false,
          },
        }),
      ).toBe('Директор');
    });
  });

  describe('compareEmployeeDirectoryLabels', () => {
    it('sorts by uk-UA primary then fullName then employeeNumber', () => {
      const rows = [
        { primary: 'Я', fullName: 'Яна Б', employeeNumber: '2' },
        { primary: 'А', fullName: 'Андрій Б', employeeNumber: '1' },
        { primary: 'А', fullName: 'Андрій А', employeeNumber: '3' },
        { primary: 'А', fullName: 'Андрій А', employeeNumber: '1' },
      ];
      rows.sort((a, b) => compareEmployeeDirectoryLabels(a, b, 1));
      expect(rows.map((r) => `${r.primary}:${r.fullName}:${r.employeeNumber}`)).toEqual([
        'А:Андрій А:1',
        'А:Андрій А:3',
        'А:Андрій Б:1',
        'Я:Яна Б:2',
      ]);
    });

    it('sorts Ukrainian AccountRole names with localeCompare', () => {
      const rows = [
        { primary: 'Працівник', fullName: 'Б', employeeNumber: '1' },
        { primary: 'Директор', fullName: 'А', employeeNumber: '1' },
        { primary: 'Адміністратор', fullName: 'В', employeeNumber: '1' },
      ];
      rows.sort((a, b) => compareEmployeeDirectoryLabels(a, b, 1));
      expect(rows.map((r) => r.primary)).toEqual([
        'Адміністратор',
        'Директор',
        'Працівник',
      ]);
    });
  });

  describe('resolveEmployeeListStatusLabel', () => {
    it('maps account states', () => {
      expect(
        resolveEmployeeListStatusLabel({ hasAccount: false }),
      ).toBe('Без акаунта');
      expect(
        resolveEmployeeListStatusLabel({
          hasAccount: true,
          accountStatus: 'deactivated',
        }),
      ).toBe('Деактивований');
      expect(
        resolveEmployeeListStatusLabel({
          hasAccount: true,
          accountStatus: 'active',
        }),
      ).toBe('Активний');
    });
  });
});
