import { EmployeeListItem } from '../core/api/models';
import { roleDisplayLabel } from '../core/api/labels';

export interface EmployeeListItemViewModel {
  id: string;
  fullName: string;
  employeeNumber: string;
  departmentName: string;
  positionName: string;
  roleLabel: string;
  statusLabel: string;
  calendarColor: string;
  detailLink: string[];
}

export function toEmployeeListItemVm(employee: EmployeeListItem): EmployeeListItemViewModel {
  return {
    id: employee.id,
    fullName: employee.fullName,
    employeeNumber: employee.employeeNumber,
    departmentName: employee.departmentName ?? '',
    positionName: employee.positionName ?? '',
    roleLabel: roleDisplayLabel(employee.role, employee.isDepartmentManager),
    statusLabel: accountStatusLabel(employee),
    calendarColor: employee.calendarColor,
    detailLink: ['/absences/employees', employee.id],
  };
}

function accountStatusLabel(e: { hasAccount: boolean; accountStatus?: string | null }): string {
  if (!e.hasAccount) return 'Без акаунта';
  return e.accountStatus === 'deactivated' ? 'Деактивований' : 'Активний';
}
