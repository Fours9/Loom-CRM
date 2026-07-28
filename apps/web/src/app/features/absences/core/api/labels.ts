export const WEEKDAY_LABELS: Record<number, string> = {
  1: 'Понеділок',
  2: 'Вівторок',
  3: 'Середа',
  4: 'Четвер',
  5: 'П\'ятниця',
  6: 'Субота',
  7: 'Неділя',
};

export const ROLE_LABELS: Record<string, string> = {
  employee: 'Працівник',
  department_manager: 'Менеджер відділу',
  admin: 'Адміністратор',
};

export function roleDisplayLabel(
  role: string | null | undefined,
  isDepartmentManager?: boolean | null,
): string {
  if (!role) return '—';
  if (role === 'admin' && isDepartmentManager) {
    return 'Адміністратор · Менеджер відділу';
  }
  return ROLE_LABELS[role] ?? role;
}

/** Ordered global absence modes: who peers may see (calendar). */
export const ABSENCE_VISIBILITY_MODE_OPTIONS: ReadonlyArray<{
  value: string;
  label: string;
}> = [
  { value: 'none', label: 'Не показувати чужі відсутності' },
  { value: 'own_department', label: 'Підтверджені лише у своєму відділі' },
  { value: 'all_approved', label: 'Усі підтверджені відсутності' },
];

/**
 * Peer calendar/request detail: type/reason visibility (employee + manager as peer).
 * Does not affect admin or managed-department scope.
 */
export const EMPLOYEE_ABSENCE_DETAIL_OPTIONS: ReadonlyArray<{
  value: 'full' | 'hide_type';
  label: string;
}> = [
  { value: 'full', label: 'Повна інформація' },
  { value: 'hide_type', label: 'Не вказувати тип (причину)' },
];

/** Ordered global profile modes (admin select). */
export const PROFILE_VISIBILITY_MODE_OPTIONS: ReadonlyArray<{
  value: string;
  label: string;
}> = [
  { value: 'none', label: 'Не показувати чужі анкети' },
  { value: 'own_department', label: 'Лише свій відділ' },
  { value: 'all', label: 'Усі працівники' },
];

export const VISIBILITY_OVERRIDE_UI = {
  inherit: 'Успадковувати глобальні налаштування',
  all: 'Усі працівники',
  own_department: 'Лише свій відділ',
  deny: 'Заборонити',
} as const;

export const ABSENCE_OVERRIDE_UI = {
  inherit: 'Успадковувати глобальні налаштування',
  all: 'Усі підтверджені відсутності',
  own_department: 'Лише свій відділ',
  deny: 'Заборонити',
} as const;

export const ABSENCE_TYPE_LABELS: Record<string, string> = {
  day_off: 'Відгул',
  vacation: 'Відпустка',
  sick_leave: 'Лікарняний',
  part_time: 'Неповний день',
  overtime: 'Понаднормові',
  business_trip: 'Відрядження',
  extra_work_day: 'Робочий день поза графіком',
};

export const ABSENCE_STATUS_LABELS: Record<string, string> = {
  pending: 'Подана',
  approved: 'Затверджена',
  rejected: 'Відхилена',
  cancelled: 'Скасована',
  deletion_requested: 'Запит на видалення',
  completed: 'Завершена',
};
