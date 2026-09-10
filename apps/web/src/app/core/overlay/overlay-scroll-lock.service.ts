import { DOCUMENT } from '@angular/common';
import { Injectable, inject, isDevMode } from '@angular/core';

interface ScrollLockSnapshot {
  htmlOverflow: string;
  bodyOverflow: string;
}

/**
 * Ref-counted page scroll lock for overlays (modals, drawers, sheets).
 *
 * Single entry: every modal/drawer should acquire() on open and release() on destroy.
 * Locks html+body and blocks wheel/touchmove that would scroll the page behind
 * the overlay, while still allowing scroll inside `.backdrop` / `.modal`.
 */
@Injectable({ providedIn: 'root' })
export class OverlayScrollLockService {
  private readonly document = inject(DOCUMENT);
  private count = 0;
  private snapshot: ScrollLockSnapshot | null = null;
  private listenersAttached = false;

  acquire(): void {
    this.count += 1;
    if (this.count !== 1) {
      return;
    }
    const html = this.document.documentElement;
    const body = this.document.body;
    this.snapshot = {
      htmlOverflow: html.style.overflow,
      bodyOverflow: body.style.overflow,
    };
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    html.classList.add('overlay-scroll-locked');
    this.attachScrollBlockers();
  }

  release(): void {
    if (this.count <= 0) {
      if (isDevMode()) {
        console.warn('[OverlayScrollLockService] release() called while unlocked');
      }
      this.count = 0;
      return;
    }
    this.count -= 1;
    if (this.count !== 0) {
      return;
    }
    this.detachScrollBlockers();
    const html = this.document.documentElement;
    const body = this.document.body;
    if (this.snapshot) {
      html.style.overflow = this.snapshot.htmlOverflow;
      body.style.overflow = this.snapshot.bodyOverflow;
      this.snapshot = null;
    }
    html.classList.remove('overlay-scroll-locked');
  }

  private attachScrollBlockers(): void {
    if (this.listenersAttached) return;
    this.listenersAttached = true;
    this.document.addEventListener('wheel', this.onWheel, {
      capture: true,
      passive: false,
    });
    this.document.addEventListener('touchmove', this.onTouchMove, {
      capture: true,
      passive: false,
    });
  }

  private detachScrollBlockers(): void {
    if (!this.listenersAttached) return;
    this.listenersAttached = false;
    this.document.removeEventListener('wheel', this.onWheel, {
      capture: true,
    } as EventListenerOptions);
    this.document.removeEventListener('touchmove', this.onTouchMove, {
      capture: true,
    } as EventListenerOptions);
  }

  private readonly onWheel = (event: WheelEvent): void => {
    if (this.allowsOverlayScroll(event.target, event.deltaY)) {
      return;
    }
    event.preventDefault();
  };

  private readonly onTouchMove = (event: TouchEvent): void => {
    if (this.allowsOverlayScroll(event.target, 0)) {
      return;
    }
    event.preventDefault();
  };

  /**
   * Allow scroll only when a scrollable ancestor inside `.backdrop` can consume it.
   * Otherwise block — including bare backdrop dim area that would chain to the page.
   */
  private allowsOverlayScroll(
    target: EventTarget | null,
    deltaY: number,
  ): boolean {
    if (!(target instanceof Element)) {
      return false;
    }
    const overlayRoot = target.closest('.backdrop');
    if (!overlayRoot) {
      return false;
    }

    let node: Element | null = target;
    while (node && overlayRoot.contains(node)) {
      if (this.canElementScroll(node, deltaY)) {
        return true;
      }
      if (node === overlayRoot) {
        break;
      }
      node = node.parentElement;
    }
    return false;
  }

  private canElementScroll(el: Element, deltaY: number): boolean {
    const style = this.document.defaultView?.getComputedStyle(el);
    if (!style) return false;
    const overflowY = style.overflowY;
    if (
      overflowY !== 'auto' &&
      overflowY !== 'scroll' &&
      overflowY !== 'overlay'
    ) {
      return false;
    }
    if (el.scrollHeight <= el.clientHeight + 1) {
      return false;
    }
    // touchmove (deltaY === 0): any scrollable overlay region may scroll
    if (deltaY === 0) {
      return true;
    }
    if (deltaY < 0) {
      return el.scrollTop > 0;
    }
    return el.scrollTop + el.clientHeight < el.scrollHeight - 1;
  }
}
