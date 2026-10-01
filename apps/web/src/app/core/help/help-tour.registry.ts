import type { HelpDomainBundle, HelpTourDefinition, HelpTourId } from './help-tour.models';

/**
 * Single runtime registry for help tours. Domain bundles register at feature load.
 */
export class HelpTourRegistry {
  private readonly tours = new Map<HelpTourId, HelpTourDefinition>();

  register(bundle: HelpDomainBundle): void {
    for (const tour of bundle.tours) {
      this.tours.set(tour.id, tour);
    }
  }

  getTour(tourId: HelpTourId): HelpTourDefinition | null {
    return this.tours.get(tourId) ?? null;
  }

  clear(): void {
    this.tours.clear();
  }
}

/** App-wide singleton used by HelpTourService (providedIn root wraps this). */
export const helpTourRegistry = new HelpTourRegistry();
