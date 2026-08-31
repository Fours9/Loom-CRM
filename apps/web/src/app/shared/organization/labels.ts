/** Ukrainian labels for org role + peer-visibility overrides (People / Absences). */

export const COMPUTED_ROLE_LABELS: Record<
  'employee' | 'department_manager',
  string
> = {
  employee: 'Працівник',
  department_manager: 'Менеджер відділу',
};

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

export const ABSENCE_TYPE_DETAIL_OVERRIDE_UI = {
  inherit: 'Успадковувати глобальні налаштування',
  full: 'Повна інформація',
  hide_type: 'Не вказувати тип (причину)',
} as const;

export type VisibilityOverrideUi =
  | 'inherit'
  | 'all'
  | 'own_department'
  | 'deny';

export type AbsenceTypeDetailOverrideUi = 'inherit' | 'full' | 'hide_type';

export function fromVisibilityOverride(
  value: string | null | undefined,
): VisibilityOverrideUi {
  if (value === 'all' || value === 'own_department' || value === 'deny') {
    return value;
  }
  return 'inherit';
}

export function toVisibilityOverride(
  value: VisibilityOverrideUi,
): 'all' | 'own_department' | 'deny' | null {
  if (value === 'inherit') return null;
  return value;
}

export function fromAbsenceTypeDetailOverride(
  value: boolean | null | undefined,
): AbsenceTypeDetailOverrideUi {
  if (value === true) return 'full';
  if (value === false) return 'hide_type';
  return 'inherit';
}

export function toAbsenceTypeDetailOverride(
  value: AbsenceTypeDetailOverrideUi,
): boolean | null {
  if (value === 'inherit') return null;
  return value === 'full';
}
