/** Stable permission names — keep in sync with @loom/contracts-auth. */
export const Permission = {
  EmployeesView: 'employees.view',
  EmployeesCreate: 'employees.create',
  EmployeesEdit: 'employees.edit',
  DepartmentsManage: 'departments.manage',
  PositionsManage: 'positions.manage',
  AbsencesCreate: 'absences.create',
  AbsencesApprove: 'absences.approve',
  AbsencesCancel: 'absences.cancel',
  AbsencesCalendarView: 'absences.calendar.view',
  SettingsManage: 'settings.manage',
  AuditView: 'audit.view',
} as const;

export type Permission = (typeof Permission)[keyof typeof Permission];
