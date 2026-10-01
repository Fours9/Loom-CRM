import type { HelpPageDescriptor } from './help-page.models';

type Entry = { context: HelpPageDescriptor; sequence: number };

/** Pure REPLACE-by-owner feature overrides (used by HelpPageContextService). */
export class HelpFeatureOverrideStore {
  private readonly overrides = new Map<string, Entry>();
  private sequence = 0;

  set(owner: string, context: HelpPageDescriptor): void {
    this.overrides.set(owner, {
      context,
      sequence: ++this.sequence,
    });
  }

  clear(owner: string): void {
    this.overrides.delete(owner);
  }

  clearAll(): void {
    this.overrides.clear();
  }

  size(): number {
    return this.overrides.size;
  }

  latest(): HelpPageDescriptor | null {
    let best: Entry | null = null;
    for (const entry of this.overrides.values()) {
      if (!best || entry.sequence > best.sequence) best = entry;
    }
    return best?.context ?? null;
  }
}
