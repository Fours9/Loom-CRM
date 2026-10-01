import type { HelpPageDescriptor, HelpRouteDescriptor } from './help-page.models';
import { matchHelpRoute } from './help-route.match';

/**
 * Registry of route → page help descriptors (domain registers from outside core).
 */
export class HelpPageContextRegistry {
  private descriptors: HelpRouteDescriptor[] = [];

  register(descriptors: readonly HelpRouteDescriptor[]): void {
    for (const d of descriptors) {
      const i = this.descriptors.findIndex((x) => x.id === d.id);
      if (i >= 0) this.descriptors[i] = d;
      else this.descriptors.push(d);
    }
  }

  match(urlOrPath: string): HelpPageDescriptor | null {
    return matchHelpRoute(this.descriptors, urlOrPath);
  }

  clear(): void {
    this.descriptors = [];
  }

  /** Test / debug */
  list(): readonly HelpRouteDescriptor[] {
    return this.descriptors;
  }
}

export const helpPageContextRegistry = new HelpPageContextRegistry();
