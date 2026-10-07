/**
 * Documents type multi-filter: empty = all; nonempty = inclusive OR.
 */
export function matchesDocumentTypeFilter<T extends string>(
  filterTypes: readonly T[],
  documentType: T,
): boolean {
  if (filterTypes.length === 0) return true;
  return filterTypes.includes(documentType);
}
