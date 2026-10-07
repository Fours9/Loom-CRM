import type {
  AbsenceType,
  CalendarQueryFilters,
  CalendarStatusGroup,
} from '../core/api/models';

export type CalendarFilterUiState = {
  departmentIds: string[];
  types: AbsenceType[];
  statusGroups: CalendarStatusGroup[];
  /** UI employee filter; empty = none. */
  employeeId: string;
  presetEmployeeId: string | null;
  isEmployeeOnly: boolean;
};

function sortedUnique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

/**
 * Sole constructor of CalendarQueryFilters for range + day loads.
 * Empty arrays / empty employee → omit key (no constraint).
 */
export function buildCalendarQueryFilters(
  state: CalendarFilterUiState,
): CalendarQueryFilters {
  const f: CalendarQueryFilters = {};

  if (!state.isEmployeeOnly) {
    const departmentIds = sortedUnique(state.departmentIds);
    if (departmentIds.length) {
      f.departmentIds = departmentIds;
    }
  }

  const employeeId = (state.presetEmployeeId || state.employeeId || '').trim();
  if (employeeId) {
    f.employeeIds = [employeeId];
  }

  const types = sortedUnique(state.types as string[]) as AbsenceType[];
  if (types.length) {
    f.types = types;
  }

  const statusGroups = sortedUnique(
    state.statusGroups as string[],
  ) as CalendarStatusGroup[];
  if (statusGroups.length) {
    f.statusGroups = statusGroups;
  }

  return f;
}
