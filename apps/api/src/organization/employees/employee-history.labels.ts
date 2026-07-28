/** Static UA summaries for employee audit timeline (v1: action only, no metadata). */

export const EMPLOYEE_HISTORY_SUMMARIES: Record<string, string> = {
  'employee.created': 'Створено профіль працівника',
  'employee.basic_updated': 'Оновлено основні дані',
  'employee.personal_updated': 'Оновлено особисті дані',
  'employee.contacts_updated': 'Оновлено робочі контакти',
  'employee.emergency_updated': 'Оновлено екстрені контакти',
  'employee.important_dates_updated': 'Оновлено важливі дати',
  'employee.assignment_changed': 'Змінено кадрове призначення',
  'employee.assignment_updated': 'Оновлено кадрове призначення',
  'employee.assignment_deleted': 'Видалено історичне призначення',
  'employee.status_changed': 'Змінено статус працівника',
  'employee.export_pdf': 'Експортовано профіль у PDF',
};

export const EMPLOYEE_HISTORY_SUMMARY_FALLBACK = 'Оновлено дані працівника';

export function summarizeEmployeeHistoryAction(action: string): string {
  return EMPLOYEE_HISTORY_SUMMARIES[action] ?? EMPLOYEE_HISTORY_SUMMARY_FALLBACK;
}
