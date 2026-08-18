import {
  catalogEscapeClosesActive,
  setCatalogDialog,
  type CatalogDialog,
} from './catalog-dialog.model';

describe('catalog dialog exclusivity', () => {
  it('cannot represent two catalog dialogs open at once', () => {
    let active: CatalogDialog = setCatalogDialog(null, 'skill');
    active = setCatalogDialog(active, 'group');
    expect(active).toBe('group');
    expect(active).not.toBe('skill');
  });

  it('Escape closes only the active catalog shell', () => {
    const active: CatalogDialog = 'direction';
    expect(catalogEscapeClosesActive(active)).toBeNull();
    expect(catalogEscapeClosesActive('skill')).toBeNull();
    expect(catalogEscapeClosesActive(null)).toBeNull();
  });
});
