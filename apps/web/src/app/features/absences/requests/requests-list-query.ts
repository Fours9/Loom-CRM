export type RequestsListSortKey =
  | 'createdAt'
  | 'startDate'
  | 'employeeName'
  | 'departmentName'
  | 'positionName'
  | 'type'
  | 'status';

export type RequestsFilterUiState = {
  statusGroups: string[];
  types: string[];
  departmentIds: string[];
  positionId: string;
  page: number;
  pageSize: number;
  sortBy: RequestsListSortKey;
  sortDir: 'asc' | 'desc';
};

export type RequestsListQuery = {
  page?: number;
  pageSize?: number;
  statusGroups?: string[];
  types?: string[];
  departmentIds?: string[];
  positionId?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
};

function sortedUnique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

/**
 * Sole constructor of the requests-list query (mirrors `buildCalendarQueryFilters`).
 * Empty arrays / empty strings → omit the key (no constraint / "all").
 * Inclusive-OR plural filters (`statusGroups`, `types`, `departmentIds`) are
 * sorted + deduped for a stable query across reloads.
 */
export function buildRequestsListQuery(
  state: RequestsFilterUiState,
): RequestsListQuery {
  const q: RequestsListQuery = {
    page: state.page,
    pageSize: state.pageSize,
    sortBy: state.sortBy,
    sortDir: state.sortDir,
  };

  const statusGroups = sortedUnique(state.statusGroups);
  if (statusGroups.length) {
    q.statusGroups = statusGroups;
  }

  const types = sortedUnique(state.types);
  if (types.length) {
    q.types = types;
  }

  const departmentIds = sortedUnique(state.departmentIds);
  if (departmentIds.length) {
    q.departmentIds = departmentIds;
  }

  if (state.positionId) {
    q.positionId = state.positionId;
  }

  return q;
}
