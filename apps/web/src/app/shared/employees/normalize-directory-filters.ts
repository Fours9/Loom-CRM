import type { OrganizationCatalogSnapshot } from '../../core/api/organization-catalog-api.service';

export type EmployeeDirectoryFilters = {
  q: string;
  directionIds: string[];
  departmentIds: string[];
  positionIds: string[];
};

export type EmployeeDirectoryFilterOption = {
  id: string;
  label: string;
};

export type EmployeeDirectoryFilterOptions = {
  directions: EmployeeDirectoryFilterOption[];
  departments: EmployeeDirectoryFilterOption[];
  positions: EmployeeDirectoryFilterOption[];
};

export const EMPTY_DIRECTORY_FILTERS: EmployeeDirectoryFilters = {
  q: '',
  directionIds: [],
  departmentIds: [],
  positionIds: [],
};

/**
 * Immutable cascade sanitizer for People directory filters.
 * - departments: if directions selected → only depts in those directions
 * - positions: if depts selected → by departmentId; else if directions → by directionId
 *   (includes departmentId=null direction-level posts); else all
 * - drops selected ids that fall out of the option set
 */
export function normalizeDirectoryFilters(
  requested: EmployeeDirectoryFilters,
  catalog: OrganizationCatalogSnapshot | null,
): {
  filters: EmployeeDirectoryFilters;
  options: EmployeeDirectoryFilterOptions;
} {
  const directions = (catalog?.directions ?? []).map((d) => ({
    id: d.id,
    label: d.name,
  }));
  const directionIdSet = new Set(requested.directionIds);

  const departmentOptions = (catalog?.departments ?? []).filter((d) => {
    if (!directionIdSet.size) return true;
    return Boolean(d.directionId && directionIdSet.has(d.directionId));
  });
  const departmentOptionIds = new Set(departmentOptions.map((d) => d.id));
  const departmentIds = requested.departmentIds.filter((id) =>
    departmentOptionIds.has(id),
  );
  const departmentIdSet = new Set(departmentIds);

  const allPositions = catalog?.positions ?? [];
  let positionPool = allPositions;
  if (departmentIdSet.size) {
    positionPool = allPositions.filter(
      (p) => p.departmentId && departmentIdSet.has(p.departmentId),
    );
  } else if (directionIdSet.size) {
    positionPool = allPositions.filter(
      (p) => p.directionId && directionIdSet.has(p.directionId),
    );
  }

  const positionOptions = positionPool.map((p) => ({
    id: p.id,
    label: p.name,
  }));
  const positionOptionIds = new Set(positionOptions.map((p) => p.id));
  const positionIds = requested.positionIds.filter((id) =>
    positionOptionIds.has(id),
  );

  const directionOptionIds = new Set(directions.map((d) => d.id));
  const directionIds = requested.directionIds.filter((id) =>
    directionOptionIds.has(id),
  );

  return {
    filters: {
      q: requested.q ?? '',
      directionIds,
      departmentIds,
      positionIds,
    },
    options: {
      directions,
      departments: departmentOptions.map((d) => ({
        id: d.id,
        label: d.name,
      })),
      positions: positionOptions,
    },
  };
}
