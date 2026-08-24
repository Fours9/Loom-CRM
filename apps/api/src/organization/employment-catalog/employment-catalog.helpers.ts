import { BadRequestException } from '@nestjs/common';

export type EmploymentCatalogItem = {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
};

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
