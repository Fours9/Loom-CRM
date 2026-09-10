/** Ukrainian labels for org leadership, account roles + peer-visibility overrides. */

import type { EmploymentManagementKind } from '@loom/contracts-employees';

export const COMPUTED_ROLE_LABELS: Record<
  'employee' | 'department_manager',
  string
> = {
  employee: 'Працівник',
  department_manager: 'Менеджер відділу',
};

/** Org leadership on a Position template / active EA — not an account role. */
export type ManagementKind = EmploymentManagementKind;

type AssertNever<T extends never> = T;
type _ManagementKindParity = AssertNever<
  | Exclude<ManagementKind, EmploymentManagementKind>
  | Exclude<EmploymentManagementKind, ManagementKind>
>;
void 0 as unknown as _ManagementKindParity;

export const MANAGEMENT_KIND_LABELS: Record<ManagementKind, string> = {
  none: 'Не керує',
  departments: 'Керує відділами',
  direction: 'Керує напрямком',
};

export const MANAGEMENT_KIND_OPTIONS: ReadonlyArray<{
  value: ManagementKind;
  label: string;
}> = (Object.keys(MANAGEMENT_KIND_LABELS) as ManagementKind[]).map((value) => ({
  value,
  label: MANAGEMENT_KIND_LABELS[value],
}));

/** Account access role code — system roles; custom roles carry their own name. */
export type AccountRoleCode =
  | 'employee'
  | 'department_manager'
  | 'director'
  | 'admin';

export const ACCOUNT_ROLE_LABELS: Record<AccountRoleCode, string> = {
  employee: 'Працівник',
  department_manager: 'Менеджер',
  director: 'Директор',
  admin: 'Адміністратор',
};

export function accountRoleLabel(
  code: string | null | undefined,
  fallbackName?: string | null,
): string {
  if (code && code in ACCOUNT_ROLE_LABELS) {
    return ACCOUNT_ROLE_LABELS[code as AccountRoleCode];
  }
  return fallbackName || code || '—';
}

export function toManagementKind(
  value: string | null | undefined,
  legacyIsDepartmentManager?: boolean | null,
): ManagementKind {
  if (value === 'departments' || value === 'direction' || value === 'none') {
    return value;
  }
  return legacyIsDepartmentManager ? 'departments' : 'none';
}

/** Only `departments` carries an explicit department multi-select. */
export function managementKindUsesDepartments(kind: ManagementKind): boolean {
  return kind === 'departments';
}

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
