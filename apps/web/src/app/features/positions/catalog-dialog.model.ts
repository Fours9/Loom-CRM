export type CatalogDialogKind = 'skill' | 'group' | 'direction' | 'department';
export type CatalogDialog = CatalogDialogKind | null;

/**
 * Visibility SoT for catalog modals: one slot, so two kinds cannot be open together.
 * Opening a kind replaces any previous kind.
 */
export function setCatalogDialog(
  _previous: CatalogDialog,
  next: CatalogDialog,
): CatalogDialog {
  return next;
}

/** Escape on the mounted catalog shell closes that shell; at most one is mounted. */
export function catalogEscapeClosesActive(_active: CatalogDialog): CatalogDialog {
  return null;
}
