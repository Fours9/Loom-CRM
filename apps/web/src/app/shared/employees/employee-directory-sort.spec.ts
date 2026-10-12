import { sortEmployeeDirectoryItems } from './employee-directory-sort';
import type { EmployeeDirectoryItemVm } from './employee-directory-item.vm';

function vm(
  partial: Pick<
    EmployeeDirectoryItemVm,
    'id' | 'fullName' | 'employeeNumber' | 'directionName'
  > &
    Partial<EmployeeDirectoryItemVm>,
): EmployeeDirectoryItemVm {
  return {
    departmentName: '',
    positionName: '',
    roleLabel: '',
    statusLabel: '',
    calendarColor: '#000',
    detailLink: ['/people', partial.id],
    ...partial,
  };
}

describe('sortEmployeeDirectoryItems', () => {
  it('sorts by direction then fullName tie-break', () => {
    const rows = [
      vm({
        id: '1',
        fullName: 'Борис Б',
        employeeNumber: '2',
        directionName: 'Бета',
      }),
      vm({
        id: '2',
        fullName: 'Андрій А',
        employeeNumber: '1',
        directionName: 'Альфа',
      }),
      vm({
        id: '3',
        fullName: 'Андрій Б',
        employeeNumber: '3',
        directionName: 'Альфа',
      }),
    ];
    expect(
      sortEmployeeDirectoryItems(rows, 'direction', 'asc').map((r) => r.id),
    ).toEqual(['2', '3', '1']);
  });

  it('respects desc on primary key', () => {
    const rows = [
      vm({
        id: '1',
        fullName: 'А',
        employeeNumber: '1',
        directionName: 'Альфа',
      }),
      vm({
        id: '2',
        fullName: 'Б',
        employeeNumber: '2',
        directionName: 'Бета',
      }),
    ];
    expect(
      sortEmployeeDirectoryItems(rows, 'direction', 'desc').map((r) => r.id),
    ).toEqual(['2', '1']);
  });
});
