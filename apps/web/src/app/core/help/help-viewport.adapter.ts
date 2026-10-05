import { Injectable } from '@angular/core';

export type HelpRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

/**
 * Injectable viewport ops so tests avoid real timers/layout.
 */
@Injectable({ providedIn: 'root' })
export class HelpViewportAdapter {
  scrollIntoView(el: HTMLElement): void {
    el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'auto' });
  }

  measure(el: HTMLElement): HelpRect {
    const r = el.getBoundingClientRect();
    return {
      top: r.top,
      left: r.left,
      width: r.width,
      height: r.height,
    };
  }

  onRemeasure(listener: () => void): () => void {
    const opts: AddEventListenerOptions = { passive: true, capture: true };
    globalThis.addEventListener?.('resize', listener, opts);
    // capture: element scrolls (e.g. .modal) do not bubble to window
    globalThis.document?.addEventListener?.('scroll', listener, opts);
    globalThis.visualViewport?.addEventListener?.('resize', listener);
    globalThis.visualViewport?.addEventListener?.('scroll', listener);
    return () => {
      globalThis.removeEventListener?.('resize', listener, opts);
      globalThis.document?.removeEventListener?.('scroll', listener, opts);
      globalThis.visualViewport?.removeEventListener?.('resize', listener);
      globalThis.visualViewport?.removeEventListener?.('scroll', listener);
    };
  }
}
