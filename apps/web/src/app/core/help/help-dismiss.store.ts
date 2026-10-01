import { Injectable } from '@angular/core';
import { helpDismissStorageKey } from './help-dismiss.keys';

export { helpDismissStorageKey } from './help-dismiss.keys';

/**
 * Versioned localStorage dismiss keys: loom.help.dismiss.<id>.v<N>
 * Fail-open if storage is unavailable.
 */
@Injectable({ providedIn: 'root' })
export class HelpDismissStore {
  isDismissed(calloutId: string, version: number): boolean {
    try {
      return (
        globalThis.localStorage?.getItem(
          helpDismissStorageKey(calloutId, version),
        ) === '1'
      );
    } catch {
      return false;
    }
  }

  dismiss(calloutId: string, version: number): void {
    try {
      globalThis.localStorage?.setItem(
        helpDismissStorageKey(calloutId, version),
        '1',
      );
    } catch {
      /* fail-open */
    }
  }

  key(calloutId: string, version: number): string {
    return helpDismissStorageKey(calloutId, version);
  }
}
