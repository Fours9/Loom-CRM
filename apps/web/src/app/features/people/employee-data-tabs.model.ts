export type EmployeeDataTabId = 'basics' | 'contacts' | 'dates';

export const EMPLOYEE_DATA_TAB_LABELS: Record<EmployeeDataTabId, string> = {
  basics: 'Основні',
  contacts: 'Контакти',
  dates: 'Дати',
};

export function employeeDataTabLabel(id: EmployeeDataTabId): string {
  return EMPLOYEE_DATA_TAB_LABELS[id] ?? id;
}
