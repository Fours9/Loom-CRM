export type EmploymentCatalogItem = {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
};

export const EMPLOYMENT_CATALOG_DESCRIPTION_MAX = 500;

export type EmploymentCatalogValidationCode =
  | 'name_required'
  | 'name_too_long'
  | 'description_too_long'
  | 'invalid_permutation'
  | 'unknown_id'
  | 'duplicate_id'
  | 'ordered_ids_invalid';

export class EmploymentCatalogValidationError extends Error {
  constructor(readonly code: EmploymentCatalogValidationCode) {
    super(code);
    this.name = 'EmploymentCatalogValidationError';
  }
}

/** Stable HTTP 400 messages (pre-typed-error wording). */
export function employmentCatalogValidationMessage(
  code: EmploymentCatalogValidationCode,
): string {
  switch (code) {
    case 'name_required':
      return 'Catalog name is required';
    case 'name_too_long':
      return 'Catalog name must be at most 64 characters';
    case 'description_too_long':
      return `Catalog description must be at most ${EMPLOYMENT_CATALOG_DESCRIPTION_MAX} characters`;
    case 'invalid_permutation':
      return 'orderedIds must include every catalog item exactly once';
    case 'unknown_id':
      return 'orderedIds contains unknown id';
    case 'duplicate_id':
      return 'orderedIds contains duplicate id';
    case 'ordered_ids_invalid':
      return 'orderedIds must be a string array';
    default: {
      const _exhaustive: never = code;
      return _exhaustive;
    }
  }
}

/** Internal invariant after lock + validated permutation; maps to HTTP 500. */
export class CatalogInvariantError extends Error {
  constructor(message = 'Catalog invariant violated') {
    super(message);
    this.name = 'CatalogInvariantError';
  }
}

export function compareCatalogItems<T extends EmploymentCatalogItem>(
  a: T,
  b: T,
): number {
  if (a.sortOrder !== b.sortOrder) {
    return a.sortOrder - b.sortOrder;
  }
  const byName = a.name.localeCompare(b.name, 'uk');
  if (byName !== 0) {
    return byName;
  }
  return a.id.localeCompare(b.id, 'uk');
}

export function normalizeCatalogName(raw: string): string {
  const name = raw.trim();
  if (!name) {
    throw new EmploymentCatalogValidationError('name_required');
  }
  if (name.length > 64) {
    throw new EmploymentCatalogValidationError('name_too_long');
  }
  return name;
}

export function normalizeCatalogDescription(
  raw: string | null | undefined,
): string | null {
  if (raw == null) {
    return null;
  }
  const description = raw.trim();
  if (!description) {
    return null;
  }
  if (description.length > EMPLOYMENT_CATALOG_DESCRIPTION_MAX) {
    throw new EmploymentCatalogValidationError('description_too_long');
  }
  return description;
}

/** Next append sort order (end of list). */
export function nextCatalogSortOrder(
  rows: ReadonlyArray<{ sortOrder: number }>,
): number {
  if (!rows.length) {
    return 0;
  }
  return Math.max(...rows.map((row) => row.sortOrder)) + 1;
}

/**
 * Validates orderedIds as a full permutation of existingIds and maps
 * each id → new contiguous sortOrder (0..n-1).
 */
export function buildCatalogReorderUpdates(
  existingIds: readonly string[],
  orderedIds: readonly string[],
): Array<{ id: string; sortOrder: number }> {
  if (orderedIds.length !== existingIds.length) {
    throw new EmploymentCatalogValidationError('invalid_permutation');
  }
  const existing = new Set(existingIds);
  const seen = new Set<string>();
  for (const id of orderedIds) {
    if (!existing.has(id)) {
      throw new EmploymentCatalogValidationError('unknown_id');
    }
    if (seen.has(id)) {
      throw new EmploymentCatalogValidationError('duplicate_id');
    }
    seen.add(id);
  }
  return orderedIds.map((id, sortOrder) => ({ id, sortOrder }));
}
