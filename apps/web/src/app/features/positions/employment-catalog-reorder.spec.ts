import { moveCatalogItem } from './employment-catalog-reorder';

describe('moveCatalogItem', () => {
  it('moves an item within the list', () => {
    expect(moveCatalogItem(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
    expect(moveCatalogItem(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b']);
  });

  it('returns a copy when indexes are unchanged or invalid', () => {
    const rows = ['a', 'b'];
    expect(moveCatalogItem(rows, 1, 1)).toEqual(['a', 'b']);
    expect(moveCatalogItem(rows, -1, 0)).toEqual(['a', 'b']);
    expect(moveCatalogItem(rows, 0, 9)).toEqual(['a', 'b']);
  });
});
