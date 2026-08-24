import {
  compareCatalogItems,
  buildCatalogReorderUpdates,
  nextCatalogSortOrder,
  normalizeCatalogDescription,
} from './employment-catalog.helpers';

describe('employment-catalog.helpers', () => {
  it('compareCatalogItems sorts by sortOrder then name', () => {
    const rows = [
      { id: 'b', name: 'Beta', description: null, sortOrder: 1, isActive: true },
      { id: 'a', name: 'Alpha', description: null, sortOrder: 0, isActive: true },
      { id: 'c', name: 'Gamma', description: null, sortOrder: 1, isActive: true },
    ];
    expect([...rows].sort(compareCatalogItems).map((r) => r.id)).toEqual([
      'a',
      'b',
      'c',
    ]);
  });

  it('buildCatalogReorderUpdates assigns contiguous order', () => {
    expect(
      buildCatalogReorderUpdates(['a', 'b', 'c'], ['c', 'a', 'b']),
    ).toEqual([
      { id: 'c', sortOrder: 0 },
      { id: 'a', sortOrder: 1 },
      { id: 'b', sortOrder: 2 },
    ]);
  });

  it('buildCatalogReorderUpdates rejects incomplete permutations', () => {
    expect(() => buildCatalogReorderUpdates(['a', 'b'], ['a'])).toThrow(
      /exactly once/,
    );
  });

  it('nextCatalogSortOrder appends after max', () => {
    expect(nextCatalogSortOrder([])).toBe(0);
    expect(nextCatalogSortOrder([{ sortOrder: 2 }, { sortOrder: 5 }])).toBe(6);
  });

  it('normalizeCatalogDescription trims and nulls blanks', () => {
    expect(normalizeCatalogDescription('  hello  ')).toBe('hello');
    expect(normalizeCatalogDescription('   ')).toBeNull();
    expect(normalizeCatalogDescription(null)).toBeNull();
  });
});
