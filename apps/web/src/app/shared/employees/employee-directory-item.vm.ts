import type { EmployeeListItem } from '@loom/contracts-employees';

export type EmployeeDirectoryItemVm = {
  id: string;
  fullName: string;
  employeeNumber: string;
  directionName: string;
  departmentName: string;
  positionName: string;
  roleLabel: string;
  statusLabel: string;
  detailLink: string[];
};

const LEGACY_ROLE_LABELS: Record<string, string> = {
  employee: 'Працівник',
  department_manager: 'Менеджер відділу',
  admin: 'Адміністратор',
};

export function toEmployeeDirectoryItemVm(
  employee: EmployeeListItem,
  detailBase: string[] = ['/people'],
): EmployeeDirectoryItemVm {
  return {
    id: employee.id,
    fullName: employee.fullName,
    employeeNumber: employee.employeeNumber,
    directionName: employee.directionName ?? '',
    departmentName: employee.departmentName ?? '',
    positionName: employee.positionName ?? '',
    roleLabel: directoryRoleLabel(employee),
    statusLabel: directoryStatusLabel(employee),
    detailLink: [...detailBase, employee.id],
  };
}

function directoryRoleLabel(employee: EmployeeListItem): string {
  if (employee.hasAccount) {
    return employee.accountRole?.name ?? '—';
  }
  if (employee.role === 'admin' && employee.isDepartmentManager) {
    return 'Адміністратор · Менеджер відділу';
  }
  return LEGACY_ROLE_LABELS[employee.role] ?? employee.role ?? '—';
}

function directoryStatusLabel(employee: EmployeeListItem): string {
  if (!employee.hasAccount) return 'Без акаунта';
  return employee.accountStatus === 'deactivated'
    ? 'Деактивований'
    : 'Активний';
}
