import { ABOUT_FIELD_DEFS } from './fields';
import type { CanonicalizeAboutResult } from './types';

/**
 * When a controller key is PRESENT in `set` and its new value makes a
 * dependent field invisible, add the dependent to clearKeys.
 * Absent controller → leave dependent alone.
 */
export function canonicalizeAboutMutation(
  set: Record<string, unknown>,
): CanonicalizeAboutResult {
  const clearKeys: string[] = [];
  const clearSet = new Set<string>();

  for (const field of ABOUT_FIELD_DEFS) {
    const vw = field.visibleWhen;
    if (!vw) continue;
    if (!Object.prototype.hasOwnProperty.call(set, vw.key)) continue;
    const controllerValue = set[vw.key];
    const visible = controllerValue === vw.equals;
    if (!visible && !clearSet.has(field.key)) {
      clearSet.add(field.key);
      clearKeys.push(field.key);
    }
  }

  // Drop dependent keys from set if they would be cleared (stale write).
  const nextSet: Record<string, unknown> = { ...set };
  for (const key of clearKeys) {
    delete nextSet[key];
  }

  return { set: nextSet, clearKeys };
}
