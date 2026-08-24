/** Move one index within a list (immutable). */
export function moveCatalogItem<T>(
  items: readonly T[],
  fromIndex: number,
  toIndex: number,
): T[] {
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= items.length ||
    toIndex >= items.length
  ) {
    return [...items];
  }
  const next = [...items];
  const [row] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, row);
  return next;
}
