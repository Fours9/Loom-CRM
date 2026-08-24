import { BadRequestException } from '@nestjs/common';

export type EmploymentCatalogItem = {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
};

export const EMPLOYMENT_CATALOG_DESCRIPTION_MAX = 500;

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
    throw new BadRequestException('Catalog name is required');
  }
  if (name.length > 64) {
    throw new BadRequestException('Catalog name must be at most 64 characters');
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
    throw new BadRequestException(
      `Catalog description must be at most ${EMPLOYMENT_CATALOG_DESCRIPTION_MAX} characters`,
    );
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
    throw new BadRequestException(
      'orderedIds must include every catalog item exactly once',
    );
  }
  const existing = new Set(existingIds);
  const seen = new Set<string>();
  for (const id of orderedIds) {
    if (!existing.has(id)) {
      throw new BadRequestException('orderedIds contains unknown id');
    }
    if (seen.has(id)) {
      throw new BadRequestException('orderedIds contains duplicate id');
    }
    seen.add(id);
  }
  return orderedIds.map((id, sortOrder) => ({ id, sortOrder }));
}
