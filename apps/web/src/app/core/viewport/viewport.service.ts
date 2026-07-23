import { DOCUMENT } from '@angular/common';
import { Injectable, OnDestroy, inject, signal } from '@angular/core';

/** Canonical tablet-up breakpoint — keep in sync with styles comment. */
export const PW_TABLET_UP_MQ = '(min-width: 641px)';

/**
 * Single source of truth for JS viewport behaviour (drawer close, overlay lock).
 * Layout itself stays CSS-driven.
 */
@Injectable({ providedIn: 'root' })
export class ViewportService implements OnDestroy {
  private readonly document = inject(DOCUMENT);
  private readonly mql: MediaQueryList | null;
  private readonly onChange: (() => void) | null;

  /** True when viewport width ≥ 641px. */
  readonly isTabletUp = signal(false);

  constructor() {
    const win = this.document.defaultView;
    if (!win || typeof win.matchMedia !== 'function') {
      this.mql = null;
      this.onChange = null;
      return;
    }
    this.mql = win.matchMedia(PW_TABLET_UP_MQ);
    this.isTabletUp.set(this.mql.matches);
    this.onChange = () => {
      if (this.mql) {
        this.isTabletUp.set(this.mql.matches);
      }
    };
    this.mql.addEventListener('change', this.onChange);
  }

  ngOnDestroy(): void {
    if (this.mql && this.onChange) {
      this.mql.removeEventListener('change', this.onChange);
    }
  }
}
