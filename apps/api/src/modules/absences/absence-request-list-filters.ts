/**
 * Pure type/statusGroup matching for the absence requests list (`findAll`).
 * Plural `types` / `statusGroups` (nonempty) win and are matched as inclusive OR;
 * otherwise fall back to the singular `type` / `statusGroup` equality check.
 * Empty/omitted plural = no constraint on that axis (not "match none").
 */

export type RequestTypeStatusGroupRow = {
  type: string;
  statusGroup: string;
};

export type RequestTypeStatusGroupFilter = {
  type?: string;
  types?: string[];
  statusGroup?: string;
  statusGroups?: string[];
};

export function matchesRequestTypeAndStatusGroup(
  row: RequestTypeStatusGroupRow,
  filter: RequestTypeStatusGroupFilter,
): boolean {
  if (filter.types?.length) {
    if (!filter.types.includes(row.type)) return false;
  } else if (filter.type) {
    if (row.type !== filter.type) return false;
  }

  if (filter.statusGroups?.length) {
    if (!filter.statusGroups.includes(row.statusGroup)) return false;
  } else if (filter.statusGroup) {
    if (row.statusGroup !== filter.statusGroup) return false;
  }

  return true;
}
