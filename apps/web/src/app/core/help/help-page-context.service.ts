import { Injectable, inject, signal } from '@angular/core';
import { NavigationStart, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import {
  HELP_PAGE_FALLBACK,
  type HelpPageDescriptor,
} from './help-page.models';
import { helpPageContextRegistry } from './help-page-context.registry';
import { HelpFeatureOverrideStore } from './help-feature-override.store';

/**
 * Resolves current page help descriptor.
 * Precedence: latest feature override → route match → fallback.
 * Feature overrides are REPLACE-by-owner (not a push stack).
 */
@Injectable({ providedIn: 'root' })
export class HelpPageContextService {
  private readonly router = inject(Router);
  private readonly registry = helpPageContextRegistry;
  private readonly features = new HelpFeatureOverrideStore();

  private routeUrl = signal(this.router.url);

  readonly current = signal<HelpPageDescriptor>(HELP_PAGE_FALLBACK);

  constructor() {
    this.recompute();
    this.router.events
      .pipe(filter((e): e is NavigationStart => e instanceof NavigationStart))
      .subscribe((e) => {
        this.features.clearAll();
        this.routeUrl.set(e.url);
        this.recompute();
      });
  }

  setFeatureContext(owner: string, context: HelpPageDescriptor): void {
    this.features.set(owner, context);
    this.recompute();
  }

  clearFeatureContext(owner: string): void {
    this.features.clear(owner);
    this.recompute();
  }

  clearAllFeatureOverrides(): void {
    this.features.clearAll();
    this.recompute();
  }

  /** Test helper */
  overrideCount(): number {
    return this.features.size();
  }

  private recompute(): void {
    const latest = this.features.latest();
    if (latest) {
      this.current.set(latest);
      return;
    }
    const matched = this.registry.match(this.routeUrl());
    this.current.set(matched ?? HELP_PAGE_FALLBACK);
  }
}
