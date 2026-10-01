/** Versioned localStorage key: loom.help.dismiss.<id>.v<N> */
export function helpDismissStorageKey(calloutId: string, version: number): string {
  return `loom.help.dismiss.${calloutId}.v${version}`;
}
