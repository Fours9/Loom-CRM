/**
 * Human-readable list labels for employee directory sort/filter display.
 * Shared by EmployeesService.findAll (sort) and serializer consumers.
 */

export const LEGACY_ROLE_LABELS: Record<string, string> = {
  employee: 'Працівник',
  department_manager: 'Менеджер відділу',
  admin: 'Адміністратор',
};

export type ListAccountRoleRef = {
  id: string;
  code: string | null;
  name: string;
  isAdminEquivalent: boolean;
};

/**
 * Role column / sortBy=role label.
 * - no account → legacy Employee.role UA label
 * - has account + accountRole → AccountRole.name
 * Callers must fail closed before this when hasAccount && accountRole missing.
 */
export function resolveEmployeeListRoleLabel(input: {
  hasAccount: boolean;
  legacyRole: string;
  isDepartmentManager?: boolean;
  accountRole: ListAccountRoleRef | null;
}): string {
  if (!input.hasAccount) {
    if (input.legacyRole === 'admin' && input.isDepartmentManager) {
      return 'Адміністратор · Менеджер відділу';
    }
    return LEGACY_ROLE_LABELS[input.legacyRole] ?? input.legacyRole;
  }
  return input.accountRole?.name ?? '';
}

export function resolveEmployeeListStatusLabel(input: {
  hasAccount: boolean;
  accountStatus?: 'active' | 'deactivated' | string | null;
}): string {
  if (!input.hasAccount) return 'Без акаунта';
  return input.accountStatus === 'deactivated' ? 'Деактивований' : 'Активний';
}

const UK_COMPARE = { sensitivity: 'base' as const };

/** localeCompare uk-UA with deterministic fullName → employeeNumber tie-break. */
export function compareEmployeeDirectoryLabels(
  a: { primary: string; fullName: string; employeeNumber: string },
  b: { primary: string; fullName: string; employeeNumber: string },
  dir: 1 | -1,
): number {
  const primary = a.primary.localeCompare(b.primary, 'uk-UA', UK_COMPARE);
  if (primary !== 0) return primary * dir;
  const name = a.fullName.localeCompare(b.fullName, 'uk-UA', UK_COMPARE);
  if (name !== 0) return name;
  return a.employeeNumber.localeCompare(b.employeeNumber, 'uk-UA', UK_COMPARE);
}

export function unionIdLists(
  singular: string | undefined,
  multi: string[] | undefined,
): string[] {
  return [
    ...new Set([...(multi ?? []), ...(singular ? [singular] : [])].filter(Boolean)),
  ];
}
