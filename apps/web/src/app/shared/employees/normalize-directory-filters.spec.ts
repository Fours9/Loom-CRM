import { normalizeDirectoryFilters } from './normalize-directory-filters';
import type { OrganizationCatalogSnapshot } from '../../core/api/organization-catalog-api.service';

describe('normalizeDirectoryFilters', () => {
  const catalog: OrganizationCatalogSnapshot = {
    companies: [],
    directions: [
      { id: 'D', name: 'Direction D', code: null, companyId: null },
      { id: 'E', name: 'Direction E', code: null, companyId: null },
    ],
    departments: [
      {
        id: 'A',
        name: 'Dept A',
        description: null,
        location: null,
        directionId: 'D',
      },
      {
        id: 'B',
        name: 'Dept B',
        description: null,
        location: null,
        directionId: 'E',
      },
    ],
    positions: [
      {
        id: 'X',
        name: 'Pos X',
        departmentId: 'A',
        directionId: 'D',
      },
      {
        id: 'Y',
        name: 'Pos Y',
        departmentId: null,
        directionId: 'D',
      },
      {
        id: 'Z',
        name: 'Pos Z',
        departmentId: 'B',
        directionId: 'E',
      },
    ],
    workFormats: [],
    employmentTypes: [],
  };

  it('includes direction-level positions when only direction D selected', () => {
    const { filters, options } = normalizeDirectoryFilters(
      {
        q: '',
        directionIds: ['D'],
        departmentIds: [],
        positionIds: ['Y', 'Z'],
      },
      catalog,
    );
    expect(options.positions.map((p) => p.id).sort()).toEqual(['X', 'Y']);
    expect(filters.positionIds).toEqual(['Y']);
    expect(filters.departmentIds).toEqual([]);
  });

  it('narrows positions by selected departments over directions', () => {
    const { options, filters } = normalizeDirectoryFilters(
      {
        q: 'a',
        directionIds: ['D'],
        departmentIds: ['A'],
        positionIds: ['X', 'Y'],
      },
      catalog,
    );
    expect(options.positions.map((p) => p.id)).toEqual(['X']);
    expect(filters.positionIds).toEqual(['X']);
  });

  it('drops departments outside selected directions', () => {
    const { filters } = normalizeDirectoryFilters(
      {
        q: '',
        directionIds: ['D'],
        departmentIds: ['A', 'B'],
        positionIds: [],
      },
      catalog,
    );
    expect(filters.departmentIds).toEqual(['A']);
  });
});
