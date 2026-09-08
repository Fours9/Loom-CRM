export type EmployeeDirectorySortKey =
  | 'fullName'
  | 'employeeNumber'
  | 'direction'
  | 'department'
  | 'position'
  | 'role'
  | 'status';

export type EmployeeDirectorySortDir = 'asc' | 'desc';

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
