/**
 * FE directory sort SoT (People + Absences lists — no pagination).
 * Determinism mirrors API `compareEmployeeDirectoryLabels` (uk-UA → fullName → employeeNumber).
 */

export type EmployeeDirectorySortKey =
  | 'fullName'
  | 'employeeNumber'
  | 'direction'
  | 'department'
  | 'position'
  | 'role'
  | 'status';

export type EmployeeDirectorySortDir = 'asc' | 'desc';

/** Minimal shape both People and Absences directory VMs satisfy. */
export type EmployeeDirectorySortable = {
  fullName: string;
  employeeNumber: string;
  departmentName: string;
  positionName: string;
  roleLabel: string;
  statusLabel: string;
  /** People directory only; Absences omits → empty for direction column. */
  directionName?: string;
};

const UK_COMPARE = { sensitivity: 'base' as const };

export function toggleDirectorySort(
  currentKey: EmployeeDirectorySortKey,
  currentDir: EmployeeDirectorySortDir,
  nextKey: EmployeeDirectorySortKey,
): { sortBy: EmployeeDirectorySortKey; sortDir: EmployeeDirectorySortDir } {
  if (currentKey === nextKey) {
    return {
      sortBy: currentKey,
      sortDir: currentDir === 'asc' ? 'desc' : 'asc',
    };
  }
  return { sortBy: nextKey, sortDir: 'asc' };
}

export function directorySortIndicator(
  activeKey: EmployeeDirectorySortKey,
  activeDir: EmployeeDirectorySortDir,
  column: EmployeeDirectorySortKey,
): string {
  if (activeKey !== column) return '↕';
  return activeDir === 'asc' ? '↑' : '↓';
}

function primarySortValue(
  item: EmployeeDirectorySortable,
  sortBy: EmployeeDirectorySortKey,
): string {
  switch (sortBy) {
    case 'employeeNumber':
      return item.employeeNumber;
    case 'direction':
      return item.directionName ?? '';
    case 'department':
      return item.departmentName;
    case 'position':
      return item.positionName;
    case 'role':
      return item.roleLabel;
    case 'status':
      return item.statusLabel;
    case 'fullName':
    default:
      return item.fullName;
  }
}

/**
 * In-memory directory sort — single FE entry for column/header toggles.
 * Server `sortBy`/`sortDir` still applied on filter/reload fetches for first paint.
 */
export function sortEmployeeDirectoryItems<T extends EmployeeDirectorySortable>(
  items: readonly T[],
  sortBy: EmployeeDirectorySortKey,
  sortDir: EmployeeDirectorySortDir,
): T[] {
  const dir: 1 | -1 = sortDir === 'desc' ? -1 : 1;
  return [...items].sort((a, b) => {
    const primary = primarySortValue(a, sortBy).localeCompare(
      primarySortValue(b, sortBy),
      'uk-UA',
      UK_COMPARE,
    );
    if (primary !== 0) return primary * dir;
    const name = a.fullName.localeCompare(b.fullName, 'uk-UA', UK_COMPARE);
    if (name !== 0) return name;
    return a.employeeNumber.localeCompare(b.employeeNumber, 'uk-UA', UK_COMPARE);
  });
}
